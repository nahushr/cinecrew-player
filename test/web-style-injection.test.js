import assert from 'node:assert/strict';
import test from 'node:test';
import { WEB_PLAYER_STYLES } from '../src/web/inlineStyles.generated.js';
import {
  installWebPlayerStyles,
  installCoreStyles,
  installControlsStyles,
  installBrightnessStyles,
  installAudioCardStyles,
  installRecordingStyles,
  installPanelStyles,
  installDiagnosticsStyles,
  installEmojiPickerStyles,
} from '../src/web/installStyles.js';

test('installs web player styles once when a DOM is available', () => {
  const previousDocument = globalThis.document;
  const elements = new Map();
  const appended = [];
  globalThis.document = {
    createElement: (tagName) => ({ tagName, id: '', textContent: '' }),
    getElementById: (id) => elements.get(id),
    head: {
      appendChild: (element) => {
        elements.set(element.id, element);
        appended.push(element);
      },
    },
  };

  try {
    installWebPlayerStyles();
    installWebPlayerStyles();

    assert.equal(appended.length, 1);
    assert.equal(appended[0].id, 'cinecrew-player-web-styles');
    assert.equal(appended[0].textContent, WEB_PLAYER_STYLES);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('installs modular style chunks on demand', () => {
  const previousDocument = globalThis.document;
  const elements = new Map();
  const appended = [];
  globalThis.document = {
    createElement: (tagName) => ({ tagName, id: '', textContent: '' }),
    getElementById: (id) => elements.get(id),
    head: {
      appendChild: (element) => {
        elements.set(element.id, element);
        appended.push(element);
      },
    },
  };

  try {
    installCoreStyles();
    installCoreStyles(); // Idempotency check
    assert.equal(appended.length, 2);
    assert.equal(appended[0].id, 'cinecrew-player-core-styles');
    assert.equal(appended[1].id, 'cinecrew-player-responsive-styles');

    installControlsStyles();
    assert.equal(appended.length, 3);
    assert.equal(appended[2].id, 'cinecrew-player-controls-styles');

    installBrightnessStyles();
    assert.equal(appended.length, 4);
    assert.equal(appended[3].id, 'cinecrew-player-brightness-styles');

    installAudioCardStyles();
    assert.equal(appended.length, 5);
    assert.equal(appended[4].id, 'cinecrew-player-audio-card-styles');

    installRecordingStyles();
    assert.equal(appended.length, 6);
    assert.equal(appended[5].id, 'cinecrew-player-recording-styles');

    installPanelStyles();
    assert.equal(appended.length, 7);
    assert.equal(appended[6].id, 'cinecrew-player-panel-styles');

    installDiagnosticsStyles();
    assert.equal(appended.length, 8);
    assert.equal(appended[7].id, 'cinecrew-player-diagnostics-styles');

    installEmojiPickerStyles();
    assert.equal(appended.length, 9);
    assert.equal(appended[8].id, 'cinecrew-player-emoji-picker-styles');
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('does not require a DOM during server-side module use', () => {
  const previousDocument = globalThis.document;
  delete globalThis.document;
  try {
    assert.doesNotThrow(() => installWebPlayerStyles());
    assert.doesNotThrow(() => installCoreStyles());
    assert.doesNotThrow(() => installControlsStyles());
  } finally {
    if (previousDocument !== undefined) globalThis.document = previousDocument;
  }
});
