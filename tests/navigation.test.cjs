const test = require('node:test');
const assert = require('node:assert/strict');
const { isNavigationURL } = require('../src/navigation.cjs');

test('chart child frames can use generated documents without exposing native schemes', () => {
  for (const value of ['blob:https://gmgn.ai/chart-id', 'data:text/html,<canvas></canvas>', 'about:srcdoc']) {
    assert.equal(isNavigationURL(value, false), true);
    assert.equal(isNavigationURL(value, true), false);
  }
  for (const value of ['file:///private', 'javascript:alert(1)', 'ms-settings:privacy']) {
    assert.equal(isNavigationURL(value, false), false);
    assert.equal(isNavigationURL(value, true), false);
  }
  assert.equal(isNavigationURL('https://dexscreener.com/chart', false), true);
});
