import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
const controlsCss = readFileSync(path.join(root, 'src/styles/controls.css'), 'utf8');
const responsiveCss = readFileSync(path.join(root, 'src/styles/responsive.css'), 'utf8');

test('web player surface clicks toggle controls without intercepting control clicks', () => {
  assert.match(webEntry, /onClick: toggleInteractionControls/);
  assert.match(webEntry, /if \(interactionControlsVisible\) \{[\s\S]*setInteractionControlsVisible\(false\)/);
  assert.match(webEntry, /if \(props\.locked\) return;/);
  assert.match(webEntry, /target\?\.closest\?\.\('button, input, select, textarea, a/);
  assert.match(webEntry, /onFocusCapture: revealInteractionControls/);
});

test('web controls stay clickable only when visible and the lock remains visible', () => {
  assert.match(controlsCss, /\.cinecrew-player--locked \.cinecrew-player__controls\s*\{\s*opacity: 1;/);
  assert.match(controlsCss, /\.cinecrew-player\.is-controls-visible \.cinecrew-player__controls :is\([\s\S]*?pointer-events: auto;/);
  assert.match(webEntry, /if \(props\.locked\) classes\.push\('cinecrew-player--locked'\)/);
  assert.doesNotMatch(controlsCss, /\.cinecrew-player:hover \.cinecrew-player__controls/);
  assert.doesNotMatch(responsiveCss, /\.cinecrew-player__controls \{ opacity: 1; \}/);
});
