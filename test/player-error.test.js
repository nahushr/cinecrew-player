import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getPlayerErrorMessage as getLibraryErrorMessage } from '../src/utils/playerError.js';
import { getPlayerErrorMessage as getDemoErrorMessage } from '../examples/web-demo/src/utils/playerErrorMessage.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('prefers the raw FLV decoder message over the player overlay summary', () => {
  const error = {
    message: 'This FLV audio codec is not supported by the browser player.',
    err: { code: -1, msg: 'Flv: Unsupported audio codec idx: 9' },
  };

  assert.equal(getLibraryErrorMessage(error), 'Flv: Unsupported audio codec idx: 9');
  assert.equal(getDemoErrorMessage(error), 'Flv: Unsupported audio codec idx: 9');
});

test('exposes actualMessage and original engine detail to onError callers', () => {
  const flvHook = readFileSync(path.join(root, 'src/native/media/web/useWebFlvPlayback.web.js'), 'utf8');
  const types = readFileSync(path.join(root, 'types/index.d.ts'), 'utf8');

  assert.match(flvHook, /actualMessage,/);
  assert.match(flvHook, /cause: errorInfo/);
  assert.match(flvHook, /err: errorInfo/);
  assert.match(types, /export interface PlayerErrorDetails/);
  assert.match(types, /actualMessage\?: string/);
  assert.match(types, /onError\?: \(error: PlayerError\) => void/);
});

test('Vite demo reports the underlying player error in its snackbar', () => {
  const viewport = readFileSync(path.join(root, 'examples/web-demo/src/components/PlayerViewport.jsx'), 'utf8');
  const app = readFileSync(path.join(root, 'examples/web-demo/src/App.jsx'), 'utf8');

  assert.match(viewport, /onPlaybackError\?\.\(error\)/);
  assert.match(app, /notify\('Playback error', getPlayerErrorMessage\(error\)/);
});

test('handles normal exceptions and preserves useful nested diagnostics', () => {
  assert.equal(getLibraryErrorMessage(new Error('decoder initialization failed')), 'decoder initialization failed');
  assert.equal(getDemoErrorMessage({ message: 'Playback failed', cause: new Error('unsupported codec') }), 'unsupported codec');
  assert.equal(getDemoErrorMessage({ actualMessage: 'HTTP 403 from origin', message: 'Playback failed' }), 'HTTP 403 from origin');
  assert.equal(getLibraryErrorMessage({ message: 'Playback failed', cause: 'raw engine detail' }), 'raw engine detail');
});
