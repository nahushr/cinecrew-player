import { useCallback, useEffect, useRef } from 'react';

function createVideoClockSynchronizer({ audio, videoRef, isCancelled }) {
  let anchorTimestamp = null;
  let previousTimestamp = null;
  let anchorVideoTime = null;

  return async (timestamp) => {
    const context = audio.context;
    const video = videoRef.current;
    if (!video) return null;
    if (anchorTimestamp === null) {
      anchorTimestamp = timestamp;
      anchorVideoTime = Number(video.currentTime) || 0;
    }
    if (previousTimestamp !== null && timestamp < previousTimestamp - 1) {
      anchorTimestamp = timestamp;
      anchorVideoTime = Number(video.currentTime) || anchorVideoTime;
    }
    previousTimestamp = timestamp;

    const getVideoDelta = () => anchorVideoTime + (timestamp - anchorTimestamp)
      - (Number(video.currentTime) || 0);
    let videoDelta = getVideoDelta();
    if (videoDelta < -0.25) return null;

    while (!isCancelled() && (context.state !== 'running' || videoDelta > 0.75)) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (isCancelled()) return null;
      videoDelta = getVideoDelta();
    }
    if (videoDelta < -0.25) return null;
    return { video, context, videoDelta };
  };
}

async function scheduleAc3Samples({ iterator, audio, videoRef, sources, isCancelled, setState }) {
  const synchronize = createVideoClockSynchronizer({ audio, videoRef, isCancelled });
  let decodedSampleCount = 0;
  for await (const sample of iterator) {
    if (isCancelled()) {
      sample.close();
      break;
    }
    const buffer = sample.toAudioBuffer();
    const timestamp = sample.timestamp;
    sample.close();
    if (isCancelled() || !buffer.numberOfChannels || !buffer.length) continue;

    const timing = await synchronize(timestamp);
    if (!timing || isCancelled()) continue;
    const source = timing.context.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.gain);
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
    };
    sources.add(source);
    const playbackRate = Math.max(0.25, Number(timing.video.playbackRate) || 1);
    source.start(timing.context.currentTime + Math.max(0.005, timing.videoDelta / playbackRate));
    decodedSampleCount += 1;
    if (decodedSampleCount === 1 || decodedSampleCount % 64 === 0) {
      setState(`playing:${decodedSampleCount}`);
    }
  }
}

async function decodeAc3Stream({ streamUrl, audio, videoRef, resources, sources, isCancelled, setState }) {
  try {
    const [{ AudioSampleSink, Input, MPEG_TS, UrlSource }, { registerAc3Decoder }] = await Promise.all([
      import('mediabunny'),
      import('@mediabunny/ac3'),
    ]);
    if (isCancelled()) return;
    registerAc3Decoder();

    resources.input = new Input({ source: new UrlSource(streamUrl), formats: [MPEG_TS] });
    const audioTrack = await resources.input.getPrimaryAudioTrack();
    if (isCancelled()) return;
    if (!audioTrack) {
      setState('no-audio-track');
      return;
    }

    resources.iterator = new AudioSampleSink(audioTrack).samples();
    setState('decoding');
    await scheduleAc3Samples({
      iterator: resources.iterator,
      audio,
      videoRef,
      sources,
      isCancelled,
      setState,
    });
  } catch (error) {
    if (!isCancelled()) setState(`error:${error?.name || 'decode'}`);
  }
}

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
    const recordingDestination = context.createMediaStreamDestination?.();
    gain.gain.value = enabledRef.current
      ? Math.max(0, Math.min(1, Number(volumeRef.current) / 100))
      : 0;
    gain.connect(context.destination);
    if (recordingDestination) gain.connect(recordingDestination);
    audioRef.current = { context, gain, recordingDestination };
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
    const resources = { input: null, iterator: null };
    const sources = new Set();
    const audio = ensureAudioContext();

    if (!audio) {
      setState('unsupported');
      return undefined;
    }

    audio.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, Number(volume) / 100)), audio.context.currentTime, 0.025);
    setState('loading');
    decodeAc3Stream({
      streamUrl,
      audio,
      videoRef,
      resources,
      sources,
      isCancelled: () => cancelled,
      setState,
    });
    return () => {
      cancelled = true;
      try { resources.iterator?.return?.(); } catch {}
      try { resources.input?.dispose(); } catch {}
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
    audioRef.current = { context: null, gain: null, recordingDestination: null };
  }, []);

  return {
    activateAudio,
    deactivateAudio,
    getRecordingAudioStream: () => audioRef.current.recordingDestination?.stream || null,
  };
}
