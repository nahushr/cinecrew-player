import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
const brightnessCss = readFileSync(path.join(root, 'src/styles/brightness.css'), 'utf8');

test('web player renders accessible brightness and sound sliders when enabled', () => {
  assert.match(webEntry, /function WebBrightnessControl\(\{ brightness, onChange, onChangeEnd, accentColor \}\)/);
  assert.match(webEntry, /function WebVolumeControl\(\{ volume, onChange, onChangeEnd, accentColor = '#FFE066', icons \}\)/);
  assert.match(webEntry, /'aria-label': 'Video brightness'/);
  assert.match(webEntry, /'aria-label': 'Device sound volume'/);
  assert.match(webEntry, /showVolumeControl: showVolumeControl \|\| showSoundControl/);
  assert.match(webEntry, /!locked && !compactInline && showBrightnessControl \? h\(WebBrightnessControl/);
  assert.match(webEntry, /!locked && !compactInline && showVolumeControl \? h\(WebVolumeControl/);
  assert.match(brightnessCss, /\.cinecrew-player__brightness-control[\s\S]*writing-mode: vertical-lr/);
  assert.match(brightnessCss, /\.cinecrew-player__volume-control[\s\S]*right: 10px/);
  assert.match(brightnessCss, /\.cinecrew-player__volume-control input[\s\S]*writing-mode: vertical-lr/);
});

test('web volume changes update playback volume and unmute when raised above zero', () => {
  assert.match(webEntry, /const updateVolume = useCallback\(\(value\) => \{[\s\S]*setVolume\(next\);[\s\S]*if \(next > 0\) setMuted\(false\)/);
  assert.match(webEntry, /onVolumeChange: updateVolume/);
  assert.match(webEntry, /video\.volume = volume/);
});
