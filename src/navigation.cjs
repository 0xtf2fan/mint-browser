const { isWebURL } = require('./address.cjs');

// Chart libraries create sandboxed child frames from blob URLs or srcdoc.
// Native/file schemes remain blocked, and these URLs cannot replace the main page.
function isNavigationURL(value, isMainFrame = true) {
  if (isWebURL(value) || value === 'about:blank') return true;
  if (isMainFrame) return false;
  if (value === 'about:srcdoc') return true;
  try { return ['blob:', 'data:'].includes(new URL(value).protocol); }
  catch { return false; }
}

module.exports = { isNavigationURL };
