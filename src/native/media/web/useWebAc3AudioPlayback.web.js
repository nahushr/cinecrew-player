import { useCallback, useEffect, useRef } from 'react';

export function useWebAc3AudioPlayback({
  active,
  streamUrl,
  enabled,
  paused,
  volume,
  videoRef,
}) {
  const audioRef = useRef({ context: null, gain: null });
  const enabledRef = useRef(enabled);
  const volumeRef = useRef(volume);
  enabledRef.current = enabled;
  volumeRef.current = volume;

  const ensureAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (audioRef.current.context) return audioRef.current;

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;

    const context = new AudioContextConstructor({ latencyHint: 'interactive' });
    const gain = context.createGain();
    gain.gain.value = enabledRef.current
      ? Math.max(0, Math.min(1, Number(volumeRef.current) / 100))
      : 0;
    gain.connect(context.destination);
    audioRef.current = { context, gain };
    return audioRef.current;
  }, []);

  const activateAudio = useCallback((nextVolume) => {
    const audio = ensureAudioContext();
    if (!audio) return false;

    const target = Math.max(0, Math.min(1, Number(nextVolume ?? volumeRef.current) / 100));
    audio.gain.gain.setTargetAtTime(target, audio.context.currentTime, 0.025);
    if (audio.context.state === 'suspended') {
      audio.context.resume().catch(() => {});
    }
    return true;
  }, [ensureAudioContext]);

  const deactivateAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio.context || !audio.gain) return;
    audio.gain.gain.setTargetAtTime(0, audio.context.currentTime, 0.02);
  }, []);

  useEffect(() => {
    const { context, gain } = audioRef.current;
    if (!context || !gain) return;
    const target = enabled ? Math.max(0, Math.min(1, Number(volume) / 100)) : 0;
    gain.gain.setTargetAtTime(target, context.currentTime, 0.025);
  }, [enabled, volume]);

  useEffect(() => {
    if (!active) return undefined;
    ensureAudioContext();
    return undefined;
  }, [active, ensureAudioContext]);

  useEffect(() => {
    const video = videoRef.current;
    const setState = (state) => {
      if (video) video.dataset.ac3AudioState = state;
    };

    if (!active || !streamUrl) {
      if (video) delete video.dataset.ac3AudioState;
      return undefined;
    }
    if (!enabled || paused) {
      deactivateAudio();
      setState(enabled ? 'paused' : 'muted');
      return undefined;
    }

    let cancelled = false;
    let input = null;
    let iterator = null;
    const sources = new Set();
    const audio = ensureAudioContext();

    if (!audio) {
      setState('unsupported');
      return undefined;
    }

    audio.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, Number(volume) / 100)), audio.context.currentTime, 0.025);
    setState('loading');
    let anchorVideoTime = null;

    const decodeAndPlay = async () => {
      try {
        const [{ AudioSampleSink, Input, MPEG_TS, UrlSource }, { registerAc3Decoder }] = await Promise.all([
          import('mediabunny'),
          import('@mediabunny/ac3'),
        ]);
        if (cancelled) return;
        registerAc3Decoder();

        input = new Input({ source: new UrlSource(streamUrl), formats: [MPEG_TS] });
        const audioTrack = await input.getPrimaryAudioTrack();
        if (cancelled) return;
        if (!audioTrack) {
          setState('no-audio-track');
          return;
        }

        const sink = new AudioSampleSink(audioTrack);
        iterator = sink.samples();
        let anchorTimestamp = null;
        let previousTimestamp = null;
        let decodedSampleCount = 0;
        setState('decoding');

        for await (const sample of iterator) {
          if (cancelled) {
            sample.close();
            break;
          }

          const buffer = sample.toAudioBuffer();
          const timestamp = sample.timestamp;
          sample.close();
          if (cancelled || !buffer.numberOfChannels || !buffer.length) continue;

          const context = audio.context;
          const videoElement = videoRef.current;
          if (!videoElement) continue;
          if (anchorTimestamp === null) {
            anchorTimestamp = timestamp;
            // The sidecar request can take several seconds to connect. Anchor
            // its first decoded sample to the video clock at arrival, not at
            // request start, otherwise all audio can be classified as stale.
            anchorVideoTime = Number(videoElement.currentTime) || 0;
          }
          if (previousTimestamp !== null && timestamp < previousTimestamp - 1) {
            // Re-anchor if a provider restarts its MPEG-TS timestamp clock.
            anchorTimestamp = timestamp;
            anchorVideoTime = Number(videoElement.currentTime) || anchorVideoTime;
          }
          previousTimestamp = timestamp;

          let videoDelta = anchorVideoTime + (timestamp - anchorTimestamp)
            - (Number(videoElement.currentTime) || 0);
          // Never replay packets whose matching picture has already passed.
          if (videoDelta < -0.25) continue;

          while (!cancelled && (context.state !== 'running' || videoDelta > 0.75)) {
            await new Promise((resolve) => setTimeout(resolve, 40));
            if (cancelled) break;
            videoDelta = anchorVideoTime + (timestamp - anchorTimestamp)
              - (Number(videoElement.currentTime) || 0);
          }
          if (cancelled) continue;
          if (videoDelta < -0.25) continue;

          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(audio.gain);
          source.onended = () => {
            sources.delete(source);
            source.disconnect();
          };
          sources.add(source);
          const playbackRate = Math.max(0.25, Number(videoElement.playbackRate) || 1);
          source.start(context.currentTime + Math.max(0.005, videoDelta / playbackRate));
          decodedSampleCount += 1;
          if (decodedSampleCount === 1 || decodedSampleCount % 64 === 0) {
            setState(`playing:${decodedSampleCount}`);
          }
        }
      } catch (error) {
        if (!cancelled) setState(`error:${error?.name || 'decode'}`);
      }
    };

    decodeAndPlay();
    return () => {
      cancelled = true;
      try { iterator?.return?.(); } catch {}
      try { input?.dispose(); } catch {}
      for (const source of sources) {
        try { source.stop(); } catch {}
        try { source.disconnect(); } catch {}
      }
      sources.clear();
    };
  }, [active, streamUrl, enabled, paused, videoRef, ensureAudioContext, deactivateAudio]);

  useEffect(() => () => {
    const { context } = audioRef.current;
    if (context && context.state !== 'closed') context.close().catch(() => {});
    audioRef.current = { context: null, gain: null };
  }, []);

  return { activateAudio, deactivateAudio };
}
