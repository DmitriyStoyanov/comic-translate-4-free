// Settings page: read/write settings + model management + connection checks.
import { BUILD } from '../shared/version.js';
import { DEFAULT_SETTINGS, NATIVE_LANGS as LANGS, TARGET_LANGS, readSettingsRaw, updateSettings } from '../shared/settings.js';
const $ = id => document.getElementById(id);
// Defaults live in shared/settings.js — single source of truth.
const DEFAULTS = DEFAULT_SETTINGS;

function fillLangs(sel, list, val) {
  // Don't rebuild a dropdown the user is interacting with right now — the
  // innerHTML reset would collapse their open list mid-selection.
  if (document.activeElement === sel) return;
  sel.innerHTML = list.map(([c, n]) => `<option value="${c}">${ctLangName(c, n)}</option>`).join('');
  sel.value = list.some(([c]) => c === val) ? val : list[0][0];
}

let allowedSites = [];

// Full settings as last loaded — collect() spreads this first so auto-managed
// fields with no UI (e.g. lmStudioModelId) survive every save.
let lastSettings = {};

// --- auto-save: every change persists within ~0.4s, no Save button ---
let saveTimer = null;
function flashSaved() {
  const el = $('saved');
  el.style.opacity = 1;
  clearTimeout(flashSaved.t);
  flashSaved.t = setTimeout(() => { el.style.opacity = 0; }, 1200);
}
function autoSave() {
  if (!formLoaded) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const s = collect();
    if (!s) return; // invalid numerics — field is red, don't save or flash
    await persistSettings(s);
    flashSaved();
  }, 400);
}
function saveNow() {
  clearTimeout(saveTimer);
  const s = collect();
  if (!s) return Promise.resolve(); // invalid — don't save or flash
  return persistSettings(s).then(flashSaved);
}

// Flush any pending debounced save if the page is closed before the timer fires.
// Guard: don't save until the form has been populated from storage, otherwise
// closing the page early would overwrite settings with empty defaults.
let formLoaded = false;
window.addEventListener('pagehide', () => {
  if (!formLoaded) return;
  clearTimeout(saveTimer);
  // collect() never returns null now (invalid numerics keep stored values),
  // so closing the page always flushes the latest toggles and fields.
  const s = collect();
  if (s) { try { persistSettings(s).catch(() => {}); } catch { /* ignore */ } }
});

function renderSiteList() {
  const ul = $('allowedSites');
  ul.innerHTML = '';
  if (!allowedSites.length) {
    const emptyMsg = ctMsg('whitelist_empty') || 'empty — translation is disabled everywhere until you add a site';
    ul.innerHTML = `<li style="color:#8a8a90">${emptyMsg}</li>`;
    return;
  }
  for (const h of allowedSites) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = h;
    const b = document.createElement('button');
    b.textContent = ctMsg('remove') || 'Remove';
    b.onclick = () => { allowedSites = allowedSites.filter(x => x !== h); renderSiteList(); saveNow(); };
    li.appendChild(span); li.appendChild(b);
    ul.appendChild(li);
  }
}

$('wlAddBtn').onclick = () => {
  let h = $('wlAdd').value.trim().toLowerCase();
  // Normalize: strip scheme, path, and a leading "*." — the origins below are
  // built from the bare host, and "*.tumblr.com" in the allowlist would never
  // match "www.tumblr.com".
  h = h.replace(/^https?:\/\//, '').split('/')[0].replace(/^\*\./, '');
  if (!h || allowedSites.includes(h)) { $('wlAdd').value = ''; renderSiteList(); return; }
  // permissions.request() must run synchronously in the click turn: the
  // awaits the old code did first (tabs.query, content-script round trip)
  // burn Firefox's transient activation, so the prompt silently never fires
  // and the site ends up "added" but unusable. Same constraint as the popup
  // grant button.
  // The typed host's origins cover the page and its subdomains (which is
  // where pictures usually live). A picture on an unrelated CDN host is
  // covered by the popup's grant row or the error pill's Allow button.
  const origins = [`*://${h}/*`, `*://*.${h}/*`];
  let req;
  try { req = chrome.permissions.request({ origins }); }
  catch { req = Promise.resolve(false); }
  Promise.resolve(req).catch(() => false).then(granted => {
    // Only add the site if the permission was actually granted — otherwise
    // it shows as "allowed" but translation can never start there.
    if (!granted) { $('wlAdd').value = ''; renderSiteList(); return; }
    allowedSites.push(h);
    $('wlAdd').value = '';
    renderSiteList();
    saveNow();
  });
};
// Enter in the input submits like the Add button. The .click() is dispatched
// synchronously inside the real keydown gesture, so Firefox's transient
// activation survives for permissions.request().
$('wlAdd').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('wlAddBtn').click(); }
});

$('allowAllSites').onchange = e => {
  const on = e.target.checked;
  // "Allow all sites" needs the <all_urls> host permission. Request it
  // synchronously in the gesture — no awaits before permissions.request()
  // or Firefox drops the user gesture and the prompt never appears.
  let p;
  try {
    p = on
      ? chrome.permissions.request({ origins: ['<all_urls>'] })
      : chrome.permissions.remove({ origins: ['<all_urls>'] }).catch(() => true);
  } catch {
    p = Promise.resolve(false);
  }
  Promise.resolve(p).then(granted => {
    // If the user dismissed/denied the prompt, revert the checkbox.
    if (on && !granted) e.target.checked = false;
    saveNow();
  }).catch(() => { if (on) e.target.checked = false; saveNow(); });
};

// Write the settings object into every form control. Used by load() and by
// the storage-change listener below. Text/number inputs the user is actively
// editing are left alone — their in-progress value wins and auto-save will
// persist it.
function setVal(id, v) {
  const el = $(id);
  if (el && document.activeElement !== el) el.value = v;
}
function setChecked(id, v) {
  const el = $(id);
  if (el) el.checked = !!v;
}
function applyToForm(s) {
  if (s.translationBackend === 'local-llm') s.translationBackend = 'google'; // backend retired from UI
  fillLangs($('sourceLang'), [['auto', ctMsg('source_auto') || 'Auto-detect'], ...LANGS], s.sourceLang);
  fillLangs($('targetLang'), TARGET_LANGS, s.targetLang);
  setVal('backend', s.translationBackend);
  setChecked('backendFailover', s.backendFailover);
  setVal('azureKey', s.azureKey || '');
  setVal('azureRegion', s.azureRegion || '');
  setVal('lmStudioUrl', s.lmStudioUrl || '');
  setVal('lmStudioApi', s.lmStudioApi || 'lmstudio-v1');
  setVal('lmStudioKey', s.lmStudioKey || '');
  setVal('translateTimeoutSec', s.translateTimeoutSec || DEFAULTS.translateTimeoutSec);
  setVal('threshold', s.detectionThreshold);
  $('thresholdVal').textContent = Number(s.detectionThreshold).toFixed(2);
  setVal('minImageSize', s.minImageSize);
  setChecked('debugMode', s.debugMode);
  setChecked('autoTranslate', s.autoTranslateOnLoad);
  setVal('displayMode', s.displayMode === 'interactive' ? 'interactive' : 'page');
  setChecked('playDing', s.playDing !== false);
  setChecked('allowAllSites', s.allowAllSites);
  allowedSites = [...(s.siteWhitelist || [])];
  renderSiteList();
}

async function load() {
  const s = await readSettingsRaw();
  lastSettings = s;
  applyToForm(s);
  formLoaded = true;
  refreshModels();
  $('clearCache').onclick = onClearCacheClick;
  refreshCacheStats();
}

// All settings writes go through here.
function persistSettings(s) {
  return chrome.storage.local.set({ settings: s });
}

// Sync with the popup (or any other writer): if settings change elsewhere,
// update the form. lastSettings is refreshed too, because collect() spreads
// it — without this, the next auto-save would clobber the remote change
// with stale values.
// No echo guard: our own writes echo back through here, but re-applying our
// own values is harmless (setVal skips the focused text input, so in-progress
// typing is never stomped), and a time-based guard has a real hazard — a
// popup write landing inside the window gets ignored, then the next
// auto-save overwrites it with the stale form.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.settings) return;
  const s = { ...DEFAULTS, ...((changes.settings && changes.settings.newValue) || {}) };
  lastSettings = s;
  if (formLoaded) applyToForm(s);
});

$('threshold').oninput = e => { $('thresholdVal').textContent = Number(e.target.value).toFixed(2); autoSave(); };

// Every control auto-saves; no Save button.
for (const id of ['displayMode', 'sourceLang', 'targetLang', 'backend', 'backendFailover', 'azureKey', 'azureRegion',
    'lmStudioUrl', 'lmStudioApi', 'lmStudioKey', 'translateTimeoutSec',
    'threshold', 'minImageSize',
    'debugMode', 'autoTranslate', 'playDing']) {
  const el = $(id);
  if (!el) continue;
  const evt = el.type === 'text' || el.type === 'password' || el.type === 'number' ? 'input' : 'change';
  // Discrete controls (checkboxes, dropdowns) save immediately: a debounced
  // toggle could still read as the old value if a run starts within 400ms
  // (e.g. unchecking failover then translating at once — the run would
  // still fail over). Typing fields keep the debounce so mid-typing values
  // don't persist.
  const save = (el.type === 'checkbox' || el.type === 'select-one') ? saveNow : autoSave;
  el.addEventListener(evt, save);
}

// Numeric validation: returns {ok, value} — clamps to [min,max], marks the
// field red on non-numeric input. Callers skip the save when !ok.
function validNum(id, raw, min, max) {
  const el = $(id);
  const v = parseFloat(raw);
  const ok = Number.isFinite(v);
  el.classList.toggle('invalid', !ok);
  if (!ok) return { ok: false };
  return { ok: true, value: Math.min(max, Math.max(min, v)) };
}

function collect() {
  // Validate numerics first; an invalid field keeps its stored value (the
  // field stays red) instead of vetoing the whole save — previously one bad
  // number silently blocked every other control's save, including toggles
  // like failover, with no "Saved" flash to explain it.
  const threshold = validNum('threshold', $('threshold').value, 0.05, 0.9);
  const minImg = validNum('minImageSize', $('minImageSize').value, 100, 4000);
  return {
    ...lastSettings,
    sourceLang: $('sourceLang').value, targetLang: $('targetLang').value,
    translationBackend: $('backend').value,
    azureKey: $('azureKey').value.trim(), azureRegion: $('azureRegion').value.trim(),
    lmStudioUrl: $('lmStudioUrl').value.trim() || DEFAULTS.lmStudioUrl,
    lmStudioApi: $('lmStudioApi').value,
    lmStudioKey: $('lmStudioKey').value.trim(),
    translateTimeoutSec: Math.min(600, Math.max(30, Math.round(Number($('translateTimeoutSec').value)) || DEFAULTS.translateTimeoutSec)),
    detectionThreshold: threshold.ok ? threshold.value : (lastSettings.detectionThreshold ?? DEFAULTS.detectionThreshold),
    minImageSize: minImg.ok ? Math.round(minImg.value) : (lastSettings.minImageSize ?? DEFAULTS.minImageSize),
    debugMode: $('debugMode').checked,
    backendFailover: $('backendFailover').checked,
    siteWhitelist: [...allowedSites], autoTranslateOnLoad: $('autoTranslate').checked,
    displayMode: $('displayMode').value === 'interactive' ? 'interactive' : 'page',
    playDing: $('playDing').checked,
    allowAllSites: $('allowAllSites').checked,
  };
}

function setCheckResult(el, r) {
  el.className = 'check-result ' + (r.ok ? 'ok' : 'err');
  el.textContent = r.ok ? '✓ ' + (r.detail || 'connected') : '✗ ' + (r.error || 'failed');
}

function checkingText() { return ctMsg('checking') || 'checking…'; }

// Save first so the check uses the latest values, then check.
$('checkAzure').onclick = async () => {
  const btn = $('checkAzure'), out = $('azureResult');
  btn.disabled = true; out.className = 'check-result'; out.textContent = checkingText();
  await persistSettings(collect());
  const r = await chrome.runtime.sendMessage({ type: 'ct/check-azure' }).catch(e => ({ ok: false, error: String(e) }));
  setCheckResult(out, r);
  btn.disabled = false;
};

$('checkLmStudio').onclick = async () => {
  const btn = $('checkLmStudio'), out = $('lmStudioResult');
  btn.disabled = true; out.className = 'check-result'; out.textContent = checkingText();
  await persistSettings(collect());
  const r = await chrome.runtime.sendMessage({ type: 'ct/check-lmstudio' }).catch(e => ({ ok: false, error: String(e) }));
  setCheckResult(out, r);
  btn.disabled = false;
};

// Grant host access for a non-localhost LM Studio URL (e.g. 192.168.x.x).
// Must run in a user gesture for Firefox (permissions.request requirement).
$('grantLmStudioHost').onclick = async () => {
  const btn = $('grantLmStudioHost'), out = $('lmStudioResult');
  const url = ($('lmStudioUrl').value || '').trim() || 'http://127.0.0.1:1234';
  let pattern = null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
      out.className = 'check-result ok';
      out.textContent = 'localhost needs no grant — already covered.';
      return;
    }
    pattern = `${u.protocol}//${u.host}/*`;
  } catch {
    out.className = 'check-result err';
    out.textContent = 'Invalid URL.';
    return;
  }
  btn.disabled = true;
  try {
    const granted = await chrome.permissions.request({ origins: [pattern] });
    out.className = 'check-result ' + (granted ? 'ok' : 'err');
    out.textContent = granted ? `Granted access to ${pattern}` : 'Grant denied.';
  } catch (e) {
    out.className = 'check-result err';
    out.textContent = 'Grant failed: ' + String((e && e.message) || e);
  }
  btn.disabled = false;
};

// --- model download progress ---------------------------------------------
// Downloads run fire-and-forget in the ML host; it broadcasts ct/model-progress
// (progress {fileId, loaded, total}, completion {fileId, done:true},
//  failure {fileId, error}). Without this listener a failed download left the
// button stuck on "Downloading…" forever with no error shown.
const dlInFlight = new Set(); // fileIds currently downloading
const dlErrors = {};          // fileId -> last download error text
const fileToGroup = {};       // fileId -> model group id (rebuilt on refresh)
const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function dlDoneCheck() {
  if (dlInFlight.size) return;
  $('downloadAll').dataset.busy = '';
  refreshModels();
}
chrome.runtime.onMessage.addListener(msg => {
  if (!msg || msg.type !== 'ct/model-progress' || !msg.fileId) return;
  const el = fileToGroup[msg.fileId] && $('model-status-' + fileToGroup[msg.fileId]);
  if (msg.error) {
    dlErrors[msg.fileId] = msg.error;
    dlInFlight.delete(msg.fileId);
    if (el) el.innerHTML = `<span style="color:#f85149">${escapeHtml(ctMsg('download_failed', [msg.error])) || escapeHtml('✗ download failed: ' + msg.error)}</span>`;
    dlDoneCheck();
  } else if (msg.done) {
    delete dlErrors[msg.fileId];
    dlInFlight.delete(msg.fileId);
    if (el) el.innerHTML = `<span style="color:#7ee787">${ctMsg('downloaded_short') || '✓ downloaded'}</span>`;
    dlDoneCheck();
  } else if (el && msg.total > 0) {
    const pct = Math.round(100 * msg.loaded / msg.total);
    el.innerHTML = `<span style="color:#58a6ff">${ctMsg('downloading', [String(pct)]) || `downloading… ${pct}%`} ` +
      `(${(msg.loaded / 1048576).toFixed(0)}/${(msg.total / 1048576).toFixed(0)} MB)</span>`;
  }
});

// ---- translated page cache ----
function fmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

async function refreshCacheStats() {
  let st = { count: 0, bytes: 0 };
  try {
    const r = await chrome.runtime.sendMessage({ type: 'ct/page-cache-stats' });
    if (r && r.ok) st = r;
  } catch { /* background unreachable — show zeros */ }
  $('cacheStats').textContent =
    ctMsg('pagecache_stats', [String(st.count), fmtBytes(st.bytes)]) ||
    `${st.count} images · ${fmtBytes(st.bytes)}`;
}

async function onClearCacheClick() {
  const btn = $('clearCache');
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = ctMsg('pagecache_clearing') || 'Clearing…';
  try {
    const r = await chrome.runtime.sendMessage({ type: 'ct/clear-page-cache' });
    if (r && r.ok) {
      $('cacheStats').textContent =
        ctMsg('pagecache_cleared', [String(r.count), fmtBytes(r.bytes)]) ||
        `Cache cleared (${r.count} images, ${fmtBytes(r.bytes)} freed)`;
      setTimeout(refreshCacheStats, 4000);
    } else {
      throw new Error((r && r.error) || 'unknown error');
    }
  } catch (e) {
    $('cacheStats').textContent = `✗ ${String((e && e.message) || e).slice(0, 100)}`;
  }
  btn.textContent = old;
  btn.disabled = false;
}

async function refreshModels() {
  const r = await chrome.runtime.sendMessage({ type: 'ct/get-models' }).catch(e => ({ ok: false, error: 'sendMessage failed: ' + String((e && e.message) || e) }));
  const box = $('models');
  box.innerHTML = '';
  const dlAll = $('downloadAll');
  if (!r || !r.ok) {
    const detail = (r && r.error) ? ` — ${r.error}` : '';
    const bgMsg = ctMsg('bg_unreachable') || 'could not reach background service';
    const bgHint = ctMsg('bg_unreachable_hint') || 'Try reloading the extension at about:debugging, then reopen this page.';
    box.innerHTML = `<span style="color:#f85149">${bgMsg}${detail}<br><span style="color:#9a9aa0;font-size:12px">${bgHint}</span></span>`;
    return;
  }
  const missing = r.models.filter(g => !g.downloaded);
  for (const g of r.models) for (const f of g.files) fileToGroup[f.id] = g.id;
  // Download one or more groups; progress arrives via ct/model-progress.
  const downloadGroups = groups => {
    dlAll.dataset.busy = '1'; dlAll.disabled = true;
    dlAll.textContent = ctMsg('downloading_generic') || 'Downloading…';
    for (const g of groups) for (const f of g.files) {
      dlInFlight.add(f.id);
      delete dlErrors[f.id];
      chrome.runtime.sendMessage({ type: 'ct/download-model', fileId: f.id }).catch(e => {
        // A send failure is surfaced like a download error so the UI never hangs.
        dlErrors[f.id] = 'sendMessage failed: ' + String((e && e.message) || e);
        dlInFlight.delete(f.id);
        dlDoneCheck();
      });
    }
    // done/error broadcasts drive dlDoneCheck -> refreshModels per file.
  };
  // One button downloads everything that's missing.
  dlAll.disabled = !missing.length || dlAll.dataset.busy === '1';
  dlAll.textContent = dlAll.dataset.busy === '1' ? dlAll.textContent
    : missing.length ? (ctMsg('download_all_n', [String(missing.length)]) || `Download all models (${missing.length} remaining)`)
    : (ctMsg('all_downloaded') || 'All models downloaded ✓');
  dlAll.onclick = () => downloadGroups(missing);
  for (const g of r.models) {
    const div = document.createElement('div');
    div.className = 'model';
    const bytes = g.files.reduce((a, f) => a + (f.bytes || 0), 0);
    const bad = g.files.filter(f => f.downloaded && !f.bytesOk);
    const sizeStr = bytes ? (bytes / 1048576).toFixed(0) + ' MB' : '';
    let status = g.sizeMismatch
      ? `<span style="color:#f0b429">${escapeHtml(ctMsg('wrong_file', [bad.map(f => f.file).join(', ')]) || `⚠ wrong file cached (${bad.map(f => f.file).join(', ')}) — press Download below to fetch the correct one`)}</span>`
      : g.downloaded
        ? `<span style="color:#7ee787">${escapeHtml(sizeStr ? (ctMsg('downloaded', [sizeStr]) || `✓ downloaded (${sizeStr})`) : (ctMsg('downloaded_short') || '✓ downloaded'))}</span>`
        : `<span style="color:#f0b429">${ctMsg('not_downloaded') || 'not downloaded'}</span>`;
    const dlErr = g.files.map(f => dlErrors[f.id]).filter(Boolean)[0];
    if (dlErr) status += `<br><span style="color:#f85149">✗ ${escapeHtml(dlErr)}</span>`;
    const label = (g.labelKey && ctMsg(g.labelKey)) || g.label;
    const reqBadge = g.required ? ` <span style="color:#f0b429;font-size:11px;border:1px solid #f0b429;border-radius:4px;padding:0 5px">${ctMsg('required_badge') || 'required'}</span>` : '';
    div.innerHTML = `<div><b>${escapeHtml(label)}</b>${reqBadge}<div id="model-status-${g.id}" style="color:#9a9aa0;font-size:12px">${status}</div></div>`;
    const btnBox = document.createElement('div');
    if (!g.downloaded || g.sizeMismatch) {
      const dl = document.createElement('button');
      dl.textContent = ctMsg(g.sizeMismatch ? 'redownload' : 'download') || (g.sizeMismatch ? 'Re-download' : 'Download');
      dl.onclick = () => { downloadGroups([g]); refreshModels(); };
      btnBox.appendChild(dl);
    }
    if (g.downloaded) {
      const b = document.createElement('button');
      b.textContent = ctMsg('delete') || 'Delete';
      b.onclick = async () => {
        await chrome.runtime.sendMessage({ type: 'ct/delete-model', id: g.id });
        refreshModels();
      };
      btnBox.appendChild(b);
    }
    div.appendChild(btnBox);
    box.appendChild(div);
  }
}

load();
ctApplyI18n();
// Deep link: #models or #models-download scrolls to the models section.
// The download variant (first run) also pulses the "Download all" button.
if (location.hash === '#models' || location.hash === '#models-download') {
  document.getElementById('modelsSection')?.scrollIntoView();
  if (location.hash === '#models-download') {
    const dl = document.getElementById('downloadAll');
    if (dl) {
      dl.classList.add('pulse');
      const stop = () => dl.classList.remove('pulse');
      dl.addEventListener('click', stop, { once: true });
      setTimeout(stop, 15000);
    }
  }
}
document.title = `${ctMsg('appName') || 'comic-translate-4-free'} — ${ctMsg('options_title') || 'Settings'}`;
try {
  const v = chrome.runtime.getManifest().version;
  $('version').textContent = `v${v}`;
} catch { $('version').textContent = 'v' + BUILD; }
