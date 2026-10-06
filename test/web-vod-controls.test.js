import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
const controlsCss = readFileSync(path.join(root, 'src/styles/controls.css'), 'utf8');

test('web VOD center controls provide clamped 10-second skips', () => {
  assert.match(webEntry, /function WebSeekSkipButton\(\{ direction, onSeek \}\)/);
  assert.match(webEntry, /Rewind 10 seconds/);
  assert.match(webEntry, /Forward 10 seconds/);
  assert.match(webEntry, /showSeekButtons = !bottomProps\.isLive\s*&& isControlEnabled\(overrides, 'seek', true\)/);
  assert.match(webEntry, /const seekBy = useCallback\(\(delta\) => \{[\s\S]*Math\.max\(0, Math\.min\(endTime, baseTime \+ \(Number\(delta\) \|\| 0\)\)\)/);
  assert.match(controlsCss, /\.cinecrew-player__seek-skip[\s\S]*width: 46px[\s\S]*height: 46px/);
});

test('web duration changes refresh VOD duration and progress bar state', () => {
  assert.match(webEntry, /video\.addEventListener\('durationchange', updateTime\)/);
  assert.match(webEntry, /video\.removeEventListener\('durationchange', updateTime\)/);
  assert.match(webEntry, /const durationHint = getPositiveDuration\(props\.durationSecs, media\.durationSecs, media\.duration_secs\)/);
  assert.match(webEntry, /const \[duration, setDuration\] = useState\(durationHint\)/);
  assert.match(webEntry, /if \(Number\.isFinite\(mediaDuration\) && mediaDuration > 0\) setDuration\(mediaDuration\)/);
  assert.match(webEntry, /duration > 0 && progressBarVisible/);
});

test('web seek and time listeners rebind when the active video element changes', () => {
  assert.match(webEntry, /video\.addEventListener\('seeking', updateTime\)/);
  assert.match(webEntry, /video\.addEventListener\('seeked', updateTime\)/);
  assert.match(webEntry, /video\.removeEventListener\('seeking', updateTime\)/);
  assert.match(webEntry, /video\.removeEventListener\('seeked', updateTime\)/);
  assert.match(webEntry, /media\.mimeType, durationHint, directVideoSource, corsMode\]\);/);
});

test('web movie title remains in the controls layer while video plays', () => {
  assert.match(webEntry, /!locked && !inlinePreview && title \? h\('div', \{ className: 'cinecrew-player__title', title \}, title\) : null/);
});
