import assert from 'node:assert/strict';
import test from 'node:test';
import { WEB_PLAYER_STYLES } from '../src/web/inlineStyles.generated.js';
import { installWebPlayerStyles } from '../src/web/installStyles.js';

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

test('does not require a DOM during server-side module use', () => {
  const previousDocument = globalThis.document;
  delete globalThis.document;
  try {
    assert.doesNotThrow(() => installWebPlayerStyles());
  } finally {
    if (previousDocument !== undefined) globalThis.document = previousDocument;
  }
});
