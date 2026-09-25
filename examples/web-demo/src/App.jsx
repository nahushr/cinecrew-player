import React, { useEffect, useMemo, useState } from 'react';
import CineCrewPlayer, { InlineLivePlayer } from '@cinecrew/cinecrew-player/react';
import '@cinecrew/cinecrew-player/styles.css';
import { allControls, asPlayerSource, sampleSources } from './samples.js';

const playerTheme = {
  accentColor: '#16c7d9',
  backgroundColor: '#07111e',
  controlBackground: '#14253a',
  controlColor: '#f8fbff',
  surfaceColor: '#102033',
  borderRadius: 16,
};

function DemoPanel({ title, source, onClose }) {
  return (
    <section className="demo-panel">
      <header><strong>{title}</strong><button onClick={onClose} aria-label="Close">×</button></header>
      <p>{source.title || source.uri}</p>
      <p>This is a demo adapter. Connect your own chat or EPG service here.</p>
    </section>
  );
}

export default function App() {
  const [active, setActive] = useState(sampleSources[0]);
  const [draftUrl, setDraftUrl] = useState(active.url);
  const [inline, setInline] = useState(false);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState('Ready');

  useEffect(() => () => {
    if (active.objectUrl) URL.revokeObjectURL(active.objectUrl);
  }, [active]);

  const integrations = useMemo(() => ({
    liveChat: { render: (props) => <DemoPanel {...props} title="Live chat" /> },
    epg: { render: (props) => <DemoPanel {...props} title="Programme guide" /> },
    recording: {
      start: async () => setStatus('Demo recording adapter: connect your recorder/storage.'),
      stop: async () => setStatus('Recording stopped.'),
    },
  }), []);

  const selectSample = (sample) => {
    setActive(sample);
    setDraftUrl(sample.url);
    setLive(Boolean(sample.isLive));
    setStatus('Loading selected sample…');
  };

  const loadUrl = (event) => {
    event.preventDefault();
    const url = draftUrl.trim();
    if (!url) return;
    setActive({ id: 'custom', title: url, url });
    setLive(false);
    setStatus('Loading URL…');
  };

  const loadFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setActive({ id: 'file', title: file.name, url: objectUrl, objectUrl });
    setLive(false);
    setDraftUrl(objectUrl);
    setStatus(`Loaded local file: ${file.name}`);
  };

  const source = { ...asPlayerSource(active), isLive: live, mediaType: live ? 'live' : 'movie' };

  return (
    <main className="demo-shell">
      <header className="page-header">
        <div><p className="eyebrow">PLAYGROUND</p><h1>CineCrew Player</h1></div>
        <span className="platform-tag">React · Vite</span>
      </header>

      <section className="source-card">
        <div className="sample-list" aria-label="Sample sources">
          {sampleSources.map((sample) => (
            <button
              className={active.id === sample.id ? 'sample active' : 'sample'}
              key={sample.id}
              onClick={() => selectSample(sample)}
            >{sample.label}</button>
          ))}
        </div>
        <form className="url-form" onSubmit={loadUrl}>
          <input aria-label="Media URL" value={draftUrl} onChange={(event) => setDraftUrl(event.target.value)} />
          <button type="submit">Load URL</button>
          <label className="file-button">
            Choose video file
            <input type="file" accept=".ts,.mp4,.mkv,video/mp4,video/x-matroska,video/mp2t" onChange={loadFile} />
          </label>
        </form>
        <label className="inline-toggle">
          <input type="checkbox" checked={inline} onChange={(event) => setInline(event.target.checked)} />
          Use compact inline player
        </label>
        <label className="inline-toggle">
          <input type="checkbox" checked={live} onChange={(event) => setLive(event.target.checked)} />
          Treat source as live
        </label>
        <p className="source-note">{status} · Browser format and CORS support depend on the source host.</p>
      </section>

      <section className="player-card" aria-label="Video player">
        {inline ? (
          <InlineLivePlayer
            key={active.url}
            source={source}
            title={active.title}
            height={360}
            isActive
            paused={false}
            controls={{ playPause: true, mute: true, fullscreen: true }}
            theme={playerTheme}
            onError={(error) => setStatus(error?.message || 'Playback error')}
            onPlaying={() => setStatus('Playing')}
          />
        ) : (
          <CineCrewPlayer
            key={active.url}
            source={source}
            title={active.title}
            mediaId={active.id}
            autoPlay
            controls={allControls}
            integrations={integrations}
            actions={{
              onBack: () => setStatus('Back action — connect your app navigation.'),
              onMinimize: () => setStatus('Minimize action — connect your app layout.'),
            }}
            features={{ diagnostics: true }}
            theme={playerTheme}
            onBuffering={(buffering) => setStatus(buffering ? 'Buffering…' : 'Ready')}
            onPlaying={() => setStatus('Playing')}
            onError={(error) => setStatus(error?.message || 'Playback error')}
          />
        )}
      </section>

      <p className="footnote">The full player enables every control and demo integration. Inline mode shows its compact play, mute, and fullscreen controls.</p>
    </main>
  );
}
