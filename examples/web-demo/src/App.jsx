import React, { useCallback, useEffect, useRef, useState } from 'react';
import '@cinecrew/cinecrew-player/styles.css';
import { asPlayerSource, sampleSources } from './samples.js';
import { PlayerViewport } from './components/PlayerViewport.jsx';
import { SourceControls } from './components/SourceControls.jsx';
import { ToastViewport } from './components/ToastViewport.jsx';
import { useDemoIntegrations } from './hooks/useDemoIntegrations.js';
import { useDemoPlayerActions } from './hooks/useDemoPlayerActions.js';
import { getPlayerErrorMessage } from './utils/playerErrorMessage.js';

export default function App() {
  const [active, setActive] = useState(sampleSources[0]);
  const [draftUrl, setDraftUrl] = useState(sampleSources[0].url);
  const [inline, setInline] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [progressTime, setProgressTime] = useState('00:00:00');
  const [drawerMode, setDrawerMode] = useState('overlay');
  const [toast, setToast] = useState(null);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState('test-1');
  const toastTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const notify = useCallback((title, message, variant = 'success') => {
    setToast({ title, message: String(message || ''), variant });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => () => {
    if (active.objectUrl) URL.revokeObjectURL(active.objectUrl);
  }, [active]);

  useEffect(() => {
    setProgressTime('00:00:00');
  }, [active.url]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const integrations = useDemoIntegrations(notify);
  const actions = useDemoPlayerActions({ notify, setSelectedAudioTrack });
  const reportPlaybackError = useCallback((error) => {
    notify('Playback error', getPlayerErrorMessage(error) || 'The media engine did not provide an error message.', 'error');
  }, [notify]);

  const selectSample = (sample) => {
    setActive(sample);
    setDraftUrl(sample.url);
    setStatus('Loading selected sample…');
  };

  const loadUrl = (event) => {
    event.preventDefault();
    const url = draftUrl.trim();
    if (!url) return;
    setActive({ id: 'custom', title: url, url });
    setStatus('Loading URL…');
  };

  const loadFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setActive({ id: 'file', title: file.name, url: objectUrl, objectUrl });
    setStatus(`Loaded local file: ${file.name}`);
  };

  const clearFile = () => {
    if (active.objectUrl) URL.revokeObjectURL(active.objectUrl);
    setActive({ id: 'cleared', title: '', url: '' });
    setStatus('Video file cleared. Choose a sample, enter a URL, or select another file.');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const source = asPlayerSource(active);
  return (
    <main className="demo-shell">
      <header className="page-header">
        <div><p className="eyebrow">PLAYGROUND</p><h1>CineCrew Player</h1></div>
        <span className="platform-tag">React · Vite</span>
      </header>

      <SourceControls
        active={active}
        draftUrl={draftUrl}
        fileInputRef={fileInputRef}
        inline={inline}
        drawerMode={drawerMode}
        onSelectSample={selectSample}
        onDraftUrlChange={setDraftUrl}
        onLoadUrl={loadUrl}
        onChooseFile={loadFile}
        onClearFile={clearFile}
        onInlineChange={setInline}
        onDrawerModeChange={setDrawerMode}
        progressTime={progressTime}
        status={status}
      />

      <section className="player-card" aria-label="Video player">
        <PlayerViewport
          active={active}
          source={source}
          drawerMode={drawerMode}
          inline={inline}
          selectedAudioTrack={selectedAudioTrack}
          integrations={integrations}
          actions={actions}
          onProgressBarChange={setProgressTime}
          onStatus={setStatus}
          onPlaybackError={reportPlaybackError}
        />
      </section>

      <p className="footnote">The chat drawer contains 15 sample messages; the demo requests 5 per page to exercise automatic loading when you scroll to the top. Production defaults to 50. Choose overlay or resized-video drawer layout above. Audio-track selection is demonstrated with Test 1 and Test 2.</p>
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
