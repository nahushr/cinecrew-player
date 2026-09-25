import React, { useEffect, useMemo, useRef, useState } from 'react';
import CineCrewPlayer, { InlineLivePlayer } from '@cinecrew/cinecrew-player/react';
import '@cinecrew/cinecrew-player/styles.css';
import { allControls, asPlayerSource, sampleSources } from './samples.js';

function createSampleChatMessages() {
  const messages = [
    ['Maya', 'That replay was unreal!'],
    ['Aarav', 'The keeper never saw it coming 😄'],
    ['Jordan', 'What a finish!'],
    ['Maya', 'This match keeps getting better.'],
    ['Leo', 'The crowd is electric tonight 🔥'],
    ['Aarav', 'Great pass to set that up.'],
    ['Priya', 'Who do you think takes the next one?'],
    ['Jordan', 'Going with the home side.'],
    ['Leo', 'Same here — they look sharp.'],
    ['Maya', 'That was so close!'],
    ['Priya', '👏👏👏'],
    ['Aarav', 'Best game this week.'],
    ['Jordan', 'One more goal would seal it.'],
    ['Leo', 'Here we go again!'],
    ['Maya', 'Enjoying the stream, everyone 💙'],
  ];
  return messages.map(([username, comment], index) => ({
    id: `demo-message-${index + 1}`,
    username,
    comment,
    timestamp: new Date(Date.now() - (messages.length - index - 1) * 4 * 60 * 1000).toISOString(),
  }));
}

export default function App() {
  const [active, setActive] = useState(sampleSources[0]);
  const [draftUrl, setDraftUrl] = useState(active.url);
  const [inline, setInline] = useState(false);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [drawerMode, setDrawerMode] = useState('overlay');
  const [sampleMessages, setSampleMessages] = useState(createSampleChatMessages);
  const sampleMessagesRef = useRef(sampleMessages);
  sampleMessagesRef.current = sampleMessages;

  useEffect(() => () => {
    if (active.objectUrl) URL.revokeObjectURL(active.objectUrl);
  }, [active]);

  const integrations = useMemo(() => ({
    user: { id: 'demo-viewer', username: 'You' },
    liveChat: {
      pollIntervalMs: 10000,
      loadMessages: async ({ limit, offset = 0 }) => {
        const messages = sampleMessagesRef.current;
        const end = Math.max(0, messages.length - offset);
        return messages.slice(Math.max(0, end - limit), end);
      },
      sendMessage: async ({ username, comment }) => {
        setSampleMessages((current) => [...current, {
          id: `demo-message-${Date.now()}`,
          username,
          comment,
          timestamp: new Date().toISOString(),
        }]);
      },
    },
    epg: {
      loadListings: async () => {
        const now = Date.now();
        return [
          { id: 'demo-epg-1', title: 'Live coverage', startMs: now - 20 * 60_000, endMs: now + 40 * 60_000, description: 'The event is underway.' },
          { id: 'demo-epg-2', title: 'Post-match analysis', startMs: now + 40 * 60_000, endMs: now + 90 * 60_000 },
          { id: 'demo-epg-3', title: 'Highlights', startMs: now + 90 * 60_000, endMs: now + 120 * 60_000 },
        ];
      },
    },
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
  const isYouTubeSource = /(?:youtube\.com|youtu\.be)/i.test(active.url || '');

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
        <label className="inline-toggle">
          Drawer layout
          <select aria-label="Drawer layout" value={drawerMode} onChange={(event) => setDrawerMode(event.target.value)}>
            <option value="overlay">Overlay video</option>
            <option value="resize">Resize video</option>
          </select>
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
            muted={isYouTubeSource}
            controls={allControls}
            integrations={integrations}
            drawerMode={drawerMode}
            drawerStyle={{ background: 'rgba(7, 17, 30, 0.84)', borderLeft: '1px solid rgba(0, 229, 255, 0.24)' }}
            messagePageSize={5}
            actions={{
              onBack: () => setStatus('Back action — connect your app navigation.'),
              onMinimize: () => setStatus('Minimize action — connect your app layout.'),
            }}
            features={{ diagnostics: true }}
            onBuffering={(buffering) => setStatus(buffering ? 'Buffering…' : 'Ready')}
            onPlaying={() => setStatus('Playing')}
            onError={(error) => setStatus(error?.message || 'Playback error')}
          />
        )}
      </section>

      <p className="footnote">The chat drawer has 15 sample messages and loads 5 per page to demonstrate “See more”; production defaults to 50. Choose overlay or resized-video drawer layout above.</p>
    </main>
  );
}
