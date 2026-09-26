import React from 'react';
import { sampleSources } from '../samples.js';

export function SourceControls({
  active,
  draftUrl,
  fileInputRef,
  inline,
  live,
  drawerMode,
  onSelectSample,
  onDraftUrlChange,
  onLoadUrl,
  onChooseFile,
  onClearFile,
  onInlineChange,
  onLiveChange,
  onDrawerModeChange,
  progressTime,
  status,
}) {
  return (
    <section className="source-card" aria-label="Player source and options">
      <div className="sample-list" aria-label="Sample sources">
        {sampleSources.map((sample) => (
          <button
            className={active.id === sample.id ? 'sample active' : 'sample'}
            key={sample.id}
            type="button"
            onClick={() => onSelectSample(sample)}
          >{sample.label}</button>
        ))}
      </div>

      <form className="url-form" onSubmit={onLoadUrl}>
        <input aria-label="Media URL" value={draftUrl} onChange={(event) => onDraftUrlChange(event.target.value)} />
        <button type="submit">Load URL</button>
      </form>

      <div className="file-source-row">
        <label className="file-button">
          Choose video file
          <input ref={fileInputRef} type="file" accept=".ts,.mp4,.mkv,video/mp4,video/x-matroska,video/mp2t" onChange={onChooseFile} />
        </label>
        {active.id === 'file' ? (
          <>
            <span className="selected-file" title={active.title}>{active.title}</span>
            <button className="clear-file" type="button" onClick={onClearFile}>Clear video file</button>
          </>
        ) : <span className="file-hint">Local video playback is independent from URL loading.</span>}
      </div>

      <div className="player-options">
        <div className="player-options-row">
          <label className="inline-toggle">
            <input type="checkbox" checked={inline} onChange={(event) => onInlineChange(event.target.checked)} />
            Use compact inline player
          </label>
        </div>
        <div className="player-options-row">
          <label className="inline-toggle">
            <input type="checkbox" checked={live} onChange={(event) => onLiveChange(event.target.checked)} />
            Treat source as live
          </label>
        </div>
        <div className="player-options-row">
          <label className="inline-toggle">
            Drawer layout
            <select aria-label="Drawer layout" value={drawerMode} onChange={(event) => onDrawerModeChange(event.target.value)}>
              <option value="overlay">Overlay video</option>
              <option value="resize">Resize video</option>
            </select>
          </label>
        </div>
      </div>
      <p className="source-note">{status} · Browser format and CORS support depend on the source host.</p>
      <p className="progress-callback-note" aria-live="polite">onProgressBarChange · {progressTime}</p>
    </section>
  );
}
