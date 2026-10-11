const $ = id => document.getElementById(id);
const send = (action, value) => window.mint.command(action, value);
let state;
let noticeTimer;
function notice(message) {
  $('notice').textContent = message; $('notice').hidden = false;
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 6000);
}
window.mint.onState(next => {
  state = next;
  $('clear').disabled = state.clearing;
  $('clear').textContent = state.clearing ? 'Clearing…' : 'Clear session';
  $('tabs').replaceChildren(...state.tabs.map(tab => {
    const group = document.createElement('div'); group.className = `tab${tab.id === state.activeId ? ' active' : ''}`;
    const label = document.createElement('button'); label.className = 'tab-label';
    label.textContent = `${tab.loading ? '◌ ' : ''}${tab.title}`; label.title = tab.title;
    label.setAttribute('role', 'tab'); label.setAttribute('aria-selected', String(tab.id === state.activeId));
    label.onclick = () => send('activate', tab.id);
    const close = document.createElement('button'); close.className = 'tab-close'; close.textContent = '×';
    close.setAttribute('aria-label', `Close ${tab.title}`); close.onclick = () => send('close', tab.id);
    group.append(label, close); return group;
  }));
  const tab = state.tabs.find(t => t.id === state.activeId);
  if (!tab) { $('home-page').hidden = false; $('address').value = ''; return; }
  $('home-page').hidden = tab.url !== 'mint://newtab';
  if (document.activeElement !== $('address')) $('address').value = tab.url === 'mint://newtab' ? '' : tab.url;
  $('protocol').textContent = tab.url.startsWith('https:') ? '◆' : '◇';
  $('protocol').title = tab.url.startsWith('https:') ? 'HTTPS connection' : tab.url.startsWith('http:') ? 'Unencrypted HTTP connection' : 'New tab';
  $('back').disabled = !tab.back; $('forward').disabled = !tab.forward;
  $('reload').textContent = tab.loading ? '×' : '↻';
  $('reload').title = tab.loading ? 'Stop loading' : 'Reload (Ctrl+R)';
  if (tab.error) notice(tab.error);
});
window.mint.onNotice(notice);
window.mint.onFocus(() => { $('address').focus(); $('address').select(); });
['back','forward','reload','home','clear'].forEach(action => { $(action).onclick = () => {
  if (action === 'clear' && !confirm('Close all tabs and clear this browsing session?')) return;
  send(action);
}; });
$('new-tab').onclick = () => send('new');
$('address-form').onsubmit = e => { e.preventDefault(); send('navigate', $('address').value); $('address').blur(); };
$('address').onfocus = () => $('address').select();
$('search-form').onsubmit = e => {
  e.preventDefault(); const query = $('search').value.trim(); if (!query) return;
  const mode = $('search-mode').value;
  const url = mode === 'token' ? `https://dexscreener.com/search?q=${encodeURIComponent(query)}` : mode === 'x' ? `https://x.com/search?q=${encodeURIComponent(query)}` : query;
  send('navigate', url);
};
document.querySelectorAll('[data-url]').forEach(button => { button.onclick = () => send('navigate', button.dataset.url); });
function updateClock() { $('clock').textContent = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }).toUpperCase(); }
updateClock(); setInterval(updateClock, 60000);
send('state');
