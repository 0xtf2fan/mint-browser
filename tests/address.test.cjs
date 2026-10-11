const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveAddress, isWebURL } = require('../src/address.cjs');
test('address bar distinguishes URLs, domains, searches and the home page', () => {
  assert.equal(resolveAddress('dexscreener.com/solana'), 'https://dexscreener.com/solana');
  assert.equal(resolveAddress('https://x.com/search?q=sol'), 'https://x.com/search?q=sol');
  assert.equal(resolveAddress('localhost:8123/test'), 'http://localhost:8123/test');
  assert.equal(resolveAddress('meme coins & charts'), 'https://duckduckgo.com/?q=meme%20coins%20%26%20charts');
  assert.equal(resolveAddress(''), 'mint://newtab');
});
test('untrusted input cannot navigate to native or executable schemes', () => {
  for (const value of ['javascript:alert(1)', 'file:///secret', 'data:text/html,hi', 'mailto:test@example.com', 'C:\\private']) {
    assert.throws(() => resolveAddress(value)); assert.equal(isWebURL(value), false);
  }
  assert.equal(isWebURL('https://example.com'), true);
});
