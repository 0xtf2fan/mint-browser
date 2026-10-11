function isWebURL(value) {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
}

function resolveAddress(input) {
  const value = String(input || '').trim().slice(0, 4096);
  if (!value || value === 'mint://newtab') return 'mint://newtab';
  if (/^https?:\/\//i.test(value)) {
    if (!isWebURL(value)) throw new Error('Enter a valid web address.');
    return new URL(value).href;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^localhost:\d+/i.test(value)) {
    throw new Error('Only HTTP and HTTPS addresses are supported.');
  }
  if (!/\s/.test(value) && /^(localhost(?::\d+)?|(?:[\w-]+\.)+[\w-]+)(?::\d+)?(?:[/?#]|$)/i.test(value)) {
    const url = `${/^localhost\b/i.test(value) ? 'http' : 'https'}://${value}`;
    if (isWebURL(url)) return new URL(url).href;
  }
  return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
}

module.exports = { resolveAddress, isWebURL };
