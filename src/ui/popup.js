// Popup: trigger runs, show progress, backend + language quick-switch, whitelist.
import { BUILD } from '../shared/version.js';
import { baseDomain, imageHostOrigins, originAccessPatterns, displayHost, hostOf, isSiteAllowed } from '../shared/site-access.js';
import { NATIVE_LANGS as LANGS, TARGET_LANGS, readSettingsRaw, updateSettings as writeSettings } from '../shared/settings.js';
const $ = id => document.getElementById(id);
// Escape for innerHTML interpolation (hostnames are DNS-safe, but explicit).
const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Stage labels come from i18n (stage_* keys), English fallback if missing.
const STAGE_LABEL = {
  idle: 'idle', capture: 'Capturing page…', detect: 'Detecting bubbles & text…',
  blocks: 'Assembling text blocks…', ocr: 'Reading text (OCR)…', mask: 'Building masks…',
  inpaint: 'Inpainting…', translate: 'Translating…', render: 'Rendering…',
  done: 'Done', cancelled: 'Cancelled', error: 'Error',
};
for (const k of Object.keys(STAGE_LABEL)) {
  const m = ctMsg('stage_' + k);
  if (m) STAGE_LABEL[k] = m;
}

let currentHost = null;

function setStatus(s) {
  $('status').textContent = s || '';
}

function setProgress(p) {
  $('progress').style.width = Math.round((p || 0) * 100) + '%';
}

// Two buttons: "Translate this page" starts a run, "Cancel" stops one.
// Translate is disabled while a run is in flight; Cancel is disabled
// when idle — so a second run can't start and there's nothing to cancel.
let running = false;
function setRunning(r) {
  running = !!r;
  $('translateBtn').disabled = running;
  $('cancelBtn').disabled = !running;
}

function fillLangs() {
  const autoLabel = ctMsg('source_auto') || 'Auto-detect';
  $('sourceLang').innerHTML = [`<option value="auto">${autoLabel}</option>`,
    ...LANGS.map(([c, n]) => `<option value="${c}">${ctLangName(c, n)}</option>`)].join('');
  $('targetLang').innerHTML = TARGET_LANGS.map(([c, n]) => `<option value="${c}">${ctLangName(c, n)}</option>`).join('');
}

async function saveLang(key, value) {
  markDirty(key);
  await writeSettings({ [key]: value });
}

// All popup settings writes go through this chain. Concurrent
// read-modify-write cycles would otherwise clobber each other: two quick
// dropdown changes → the second get() returns pre-first-set() state → the
// first change is silently lost ("needs multiple tries").

let lastStatus = null;

// ---- init race guards ----
// refreshSettings() is async and can finish AFTER the user has already used a
// control. Two hazards:
//  1. A dropdown the user already changed: re-setting .value from the stale
//     storage read snaps their pick back ("needs 2 tries").
//  2. A control the user is interacting with right now (focused / dropdown
//     open): re-setting its value mid-interaction disrupts the native widget.
// During init the user's value wins; after init, storage wins (cross-page
// sync). A focused control is never stomped.
let initDone = false;
const initDirty = new Set();
function markDirty(id) { if (!initDone) initDirty.add(id); }
function keepUserValue(id) {
  const el = $(id);
  return (!initDone && initDirty.has(id)) || (el && document.activeElement === el);
}
// The background thread can be unresponsive while a pipeline runs — on
// Firefox, WASM inpaint blocks the background page's main thread, so a
// sendMessage may not resolve for tens of seconds. Time out fast so the
// popup stays usable; the 3s interval retries.
function bgMessage(msg, timeoutMs = 2500) {
  return Promise.race([
    chrome.runtime.sendMessage(msg).catch(() => null),
    new Promise(r => setTimeout(() => r(null), timeoutMs)),
  ]);
}
async function refreshStatus() {
  const st = await bgMessage({ type: 'ct/get-status' });
  if (st && st.ok) {
    const s = st.status;
    lastStatus = s;
    setStatus(STAGE_LABEL[s.stage] || s.stage);
    setProgress(s.progress);
    // Never wipe an error here: a failed click shows its error via the
    // message response just before this refresh runs. Only ever set.
    if (s.error) $('error').textContent = s.error;
    const isRunning = s.stage && !['done', 'idle', 'error', 'cancelled'].includes(s.stage);
    setRunning(isRunning);
  }
}

async function refreshSettings() {
  const settings = await readSettingsRaw();
  // Reconcile the allow-all-sites flag with the real <all_urls> permission.
  // The permission prompt steals focus and can close the popup, killing this
  // JS context before permissions.request() resolves — the grant then never
  // reaches storage, so the checkbox looks off on the next open even though
  // the permission was granted (the "needs multiple tries" bug). The
  // permission itself is the source of truth; fix storage to match it.
  // The write below only fires on mismatch, so the storage.onChanged echo
  // re-running refreshSettings() terminates after one extra pass.
  try {
    const has = await chrome.permissions.contains({ origins: ['<all_urls>'] });
    if (settings && !!settings.allowAllSites !== has) {
      // Re-read before writing: the object captured above can go stale
      // during the permissions.contains await (e.g. the first-run consume
      // clearing firstRun in the meantime). Merge only the reconciled flag
      // into fresh state so a stale write can't resurrect firstRun or
      // clobber a concurrent change.
      const fresh = await readSettingsRaw();
      await chrome.storage.local.set({ settings: { ...(fresh || {}), allowAllSites: has } });
    }
  } catch { /* permissions API unavailable — leave storage alone */ }
  if (settings) {
    // Never stomp a control the user already set or is using (see the init
    // race guards above): during init their pick wins, and a focused control
    // keeps its value so an open dropdown isn't disrupted mid-interaction.
    if (!keepUserValue('backend') && settings.translationBackend) $('backend').value =
      settings.translationBackend === 'local-llm' ? 'google' : settings.translationBackend;
    if (!keepUserValue('sourceLang') && settings.sourceLang) $('sourceLang').value = settings.sourceLang;
    if (!keepUserValue('targetLang')) {
      if (settings.targetLang && TARGET_LANGS.some(([c]) => c === settings.targetLang)) $('targetLang').value = settings.targetLang;
      else $('targetLang').value = 'en';
    }
    if (!keepUserValue('displayMode')) $('displayMode').value = settings.displayMode === 'interactive' ? 'interactive' : 'page';
    if (!keepUserValue('allowAllSites')) $('allowAllSites').checked = !!(settings && settings.allowAllSites);
  }
  initDone = true;
  await refreshSite(settings || {});
}

// Full refresh: status + settings. The 3s interval only needs the status
// part — rewriting the settings dropdowns on every tick stomps the user's
// in-progress selection (the open language list collapses), so settings
// controls update only here, at init, and on real storage changes.
async function refresh() {
  // Status and settings load in parallel: a hung status (blocked background)
  // must not delay the settings UI.
  await Promise.all([refreshStatus(), refreshSettings()]);
}

// The picture often lives on a CDN host different from the page host; without
// permission for it the extension can't download the picture's pixels.
// cachedImageHost is filled in (best effort) when the popup opens, so the
// click handler below can build the full origin list SYNCHRONOUSLY — Firefox
// expires the click's user gesture across awaits, and permissions.request()
// called after an await silently does nothing.
let cachedImageHost = null;
// A granted `*://host/*` satisfies the query, but be lenient like
// hasHostAccess in the service worker: scheme-specific grants count too.
async function hasOriginAccess(host) {
  // Accept an exact-host grant OR a base-domain grant (covers random
  // per-visit subdomains); existing exact grants keep working.
  for (const p of originAccessPatterns(host)) {
    if (await chrome.permissions.contains({ origins: [p] }).catch(() => false)) return true;
  }
  return false;
}
function requestSiteAccessNow(host) {
  const origins = [`*://${host}/*`, `*://*.${host}/*`];
  // The picture's host gets the base-domain treatment: hosts with random
  // per-visit subdomains (e.g. *.hath.network) would otherwise need a fresh
  // grant on every visit.
  if (cachedImageHost && cachedImageHost !== host) origins.push(...imageHostOrigins(cachedImageHost));
  if (chrome.permissions && chrome.permissions.request) {
    return chrome.permissions.request({ origins }).catch(() => false);
  }
  return Promise.resolve(false);
}

async function refreshSite(settings) {  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [null]);
  currentHost = tab ? hostOf(tab.url) : null;
  // Learn the page picture's host now (not on click) so the grant click can
  // request it without any awaits first — pictures often live on a CDN host
  // different from the page host, and the pipeline's download tier needs
  // permission for it. Awaited here: this is popup-open time, not a click
  // gesture, so awaits are fine.
  cachedImageHost = null;
  if (tab && tab.id != null) {
    try {
      const r = await chrome.tabs.sendMessage(tab.id, { type: 'ct/find-image' }).catch(() => null);
      const src = r && r.image && r.image.src;
      if (src && /^https?:\/\//i.test(src)) {
        const ih = new URL(src).hostname.toLowerCase();
        if (ih && ih !== currentHost) cachedImageHost = ih;
      }
    } catch { /* content script not injected yet — page host is enough to try */ }
  }
  const list = settings.siteWhitelist || [];
  const btn = $('whitelistBtn');
  if (!currentHost) {
    $('site').innerHTML = ctMsg('no_site') || 'no site detected';
    btn.disabled = true;
    btn.classList.remove('remind');
    return;
  }
  const allowAll = !!settings.allowAllSites;
  const ok = allowAll || isSiteAllowed(currentHost, list);
  const hostHtml = `<b>${escHtml(currentHost)}</b>`;
  const statusHtml = allowAll
    ? `<span class="ok">${ctMsg('all_sites_on') || 'all sites allowed ✓'}</span>`
    : ok
      ? `<span class="ok">${ctMsg('whitelisted') || 'allowed ✓'}</span>`
      : `<span class="warn">${ctMsg('not_whitelisted') || 'not allowed'}</span>`;
  // site_this = "this site: $HOST$ — $STATUS$" (word order localized per locale)
  $('site').innerHTML = ctMsg('site_this', [hostHtml, statusHtml]) || `this site: ${hostHtml} — ${statusHtml}`;
  if (allowAll) {
    // Per-site allow/disallow is meaningless when every site is allowed.
    btn.style.display = 'none';
  } else {
    btn.style.display = '';
    btn.textContent = ctMsg(ok ? 'whitelist_remove' : 'whitelist_add') || (ok ? 'Disallow this site' : 'Allow this site');
    btn.disabled = false;
    // Light the button up until the site is allowed — it's the reminder.
    btn.classList.toggle('remind', !ok);
  }
  // Allowed but missing host access: offer the one-click grant. This covers
  // BOTH the page host (needed for script injection) and the picture's host
  // (needed for the download tier) — the picture often lives on a CDN. After
  // the first grant the content script can inject, so the picture host becomes
  // known and a second click covers it; the row stays visible until both are
  // granted, naming whichever host is still missing.
  const grantRow = $('grantRow');
  grantRow.style.display = 'none';
  if (ok && currentHost && chrome.permissions && chrome.permissions.contains) {
    const pageHas = await hasOriginAccess(currentHost);
    const imgHas = !cachedImageHost || await hasOriginAccess(cachedImageHost);
    const missing = !pageHas ? currentHost : (!imgHas ? cachedImageHost : null);
    if (missing) {
      grantRow.style.display = '';
      // Name the base domain for the picture's host: the exact hostname is
      // random per visit on some sites, and the grant covers the base.
      const missingLabel = (missing === cachedImageHost) ? displayHost(missing) : missing;
      $('grantBtn').textContent = ctMsg('grant_access_to', [missingLabel]) || `Grant access to ${missingLabel}`;
      $('grantBtn').onclick = () => {
        // Request synchronously in the click: no awaits before
        // permissions.request() or Firefox drops the user gesture.
        requestSiteAccessNow(currentHost).then(() => refreshSite(settings));
      };
    }
  }
  // The last failed run named the exact image host that needs a grant (the
  // pill's one-click grant can't work on Firefox — the content-script click
  // gesture doesn't reach the worker — so it points here). Offer it directly;
  // more reliable than the find-image heuristic above.
  if (grantRow.style.display === 'none' && lastStatus && lastStatus.stage === 'error' &&
      lastStatus.grantHost && chrome.permissions && chrome.permissions.request) {
    const gh = lastStatus.grantHost;
    if (!(await hasOriginAccess(gh).catch(() => true))) {
      const gl = lastStatus.grantLabel || displayHost(gh);
      grantRow.style.display = '';
      $('grantBtn').textContent = ctMsg('grant_access_to', [gl]) || `Grant access to ${gl}`;
      $('grantBtn').onclick = () => {
        // Synchronous in the click — no awaits before permissions.request().
        chrome.permissions.request({ origins: imageHostOrigins(gh) })
          .catch(() => false).then(() => refreshSite(settings));
      };
    }
  }
  btn.onclick = () => {
    const wl = new Set(settings.siteWhitelist || []);
    const granting = !isSiteAllowed(currentHost, [...wl]);
    if (granting) {
      // Optimistic list write FIRST, without awaiting: the permission prompt
      // can close the popup and kill this context before the .then() below
      // runs (same hazard as the allow-all-sites checkbox). The intent must
      // already be in storage. Denial rolls it back below.
      wl.add(currentHost);
      chrome.storage.local.set({
        settings: { ...settings, siteWhitelist: [...wl] },
      }).catch(() => {});
    }
    // Granting host access here (a user gesture) lets auto-translate and
    // full-resolution image fetch work on this site without further clicks.
    // The permission request must run synchronously in the click turn — no
    // awaits before permissions.request() or Firefox drops the transient
    // activation and the prompt silently never fires.
    let req = null;
    if (granting) {
      try { req = requestSiteAccessNow(currentHost); } catch { /* keep going */ }
    }
    Promise.resolve(req).catch(() => false).then(async granted => {
      // Re-read: the optimistic write above (or a Settings-page edit) may
      // have moved the list since this handler ran.
      let cur = null;
      try { (cur = await readSettingsRaw()); } catch { /* keep going */ }
      const wl2 = new Set((cur && cur.siteWhitelist) || []);
      if (granting) {
        if (!granted) wl2.delete(currentHost); // denied: roll back the optimistic add
        else wl2.add(currentHost);
      } else for (const e of [...wl2]) {
        const w = String(e).toLowerCase();
        if (currentHost === w || currentHost.endsWith('.' + w)) wl2.delete(e);
      }
      const next = { ...(cur || {}), siteWhitelist: [...wl2] };
      await writeSettings({ siteWhitelist: next.siteWhitelist });
      refreshSite(next);
    });
  };
}

$('cancelBtn').onclick = () => {
  chrome.runtime.sendMessage({ type: 'ct/cancel-run' }).catch(() => {});
};

$('translateBtn').onclick = async () => {
  $('error').textContent = '';
  try {
    // Best-effort one-time permission so the worker can download the page's
    // picture at full resolution (covers the picture's host too).
    // Uses the host cached at popup-open: no awaits before
    // permissions.request(), so Firefox's transient activation survives and
    // the prompt actually fires.
    if (currentHost) await requestSiteAccessNow(currentHost);
  } catch { /* optional; the pipeline reports what it can't read */ }
  const r = await chrome.runtime.sendMessage({ type: 'ct/translate-page' }).catch(e => ({ ok: false, error: String(e) }));
  if (!r.ok) $('error').textContent = r.error;
  refresh();
};

$('displayMode').onchange = e => {
  markDirty('displayMode');
  writeSettings({ displayMode: e.target.value === 'interactive' ? 'interactive' : 'page' }).catch(() => {});
};

$('backend').onchange = e => {
  markDirty('backend');
  writeSettings({ translationBackend: e.target.value }).catch(() => {});
};

// ---- translated page cache (same stats as the Settings page) ----
function fmtBytes(n) {
  n = Number(n) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

async function refreshCacheStats() {
  let st = { count: 0, bytes: 0 };
  try {
    const r = await bgMessage({ type: 'ct/page-cache-stats' });
    if (r && r.ok) st = r;
  } catch { /* background unreachable — show zeros */ }
  $('cacheInfo').textContent =
    ctMsg('pagecache_stats', [String(st.count), fmtBytes(st.bytes)]) ||
    `${st.count} images · ${fmtBytes(st.bytes)}`;
}

$('clearCacheBtn').onclick = async () => {
  const btn = $('clearCacheBtn');
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = ctMsg('pagecache_clearing') || 'Clearing…';
  try {
    const r = await chrome.runtime.sendMessage({ type: 'ct/clear-page-cache' });
    if (r && r.ok) {
      $('cacheInfo').textContent =
        ctMsg('pagecache_cleared', [String(r.count), fmtBytes(r.bytes)]) ||
        `Cache cleared (${r.count} images, ${fmtBytes(r.bytes)} freed)`;
      setTimeout(refreshCacheStats, 4000);
    } else {
      throw new Error((r && r.error) || 'unknown error');
    }
  } catch (e) {
    $('cacheInfo').textContent = `✗ ${String((e && e.message) || e).slice(0, 100)}`;
  }
  btn.textContent = old;
  btn.disabled = false;
};

$('sourceLang').onchange = e => saveLang('sourceLang', e.target.value);
$('targetLang').onchange = e => saveLang('targetLang', e.target.value);

// Allow-all-sites toggle. The <all_urls> request must run synchronously in
// the change gesture — no awaits before it — or Firefox drops the transient
// activation and the prompt silently never appears.
// Note: the permission prompt can close the popup and kill this JS context
// before the request resolves; the .then() below then never runs. That's OK:
// the permission itself is durable, and refreshSettings() reconciles storage
// with it on the next popup open, so one click is enough.
$('allowAllSites').onchange = e => {
  const on = e.target.checked;
  markDirty('allowAllSites');
  let p;
  try {
    p = on
      ? chrome.permissions.request({ origins: ['<all_urls>'] })
      : chrome.permissions.remove({ origins: ['<all_urls>'] }).catch(() => true);
  } catch {
    p = Promise.resolve(false);
  }
  Promise.resolve(p).then(async granted => {
    if (on && !granted) { e.target.checked = false; return; } // denied: revert
    await writeSettings({ allowAllSites: on });
    refresh();
  }).catch(() => { if (on) e.target.checked = false; });
};

// Sync with the Settings page (and any other settings writer): re-render when
// settings change elsewhere. Our own writes echo back through here too, but
// refreshSettings() only reads, so re-running it is harmless.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) refreshSettings().catch(() => {});
});

$('options').onclick = e => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
};

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'ct/run-progress') {
    setStatus(STAGE_LABEL[msg.stage] || msg.stage);
    setProgress(msg.progress);
    if (msg.stage === 'error') $('error').textContent = msg.error || 'unknown error';
    else if (msg.stage === 'done') $('error').textContent = '';
    setRunning(msg.stage && !['done', 'idle', 'error', 'cancelled'].includes(msg.stage));
  }
});

ctApplyI18n();
fillLangs();
// First run: send the user straight to the models section of the Settings
// page, with the Download all button highlighted. One-time flag set by the
// SW's onInstalled handler; consumed here.
(async () => {
  try {
    const settings = await readSettingsRaw();
    if (settings && settings.firstRun) {
      await chrome.storage.local.set({ settings: { ...settings, firstRun: false } });
      chrome.tabs.create({ url: chrome.runtime.getURL('src/ui/options.html#models-download') });
      window.close();
      return;
    }
  } catch { /* popup works fine without the redirect */ }
})();
try {
  const v = chrome.runtime.getManifest().version;
  $('build').textContent = `v${v}`;
} catch { $('build').textContent = 'v' + BUILD; }
refresh();
refreshCacheStats();
setInterval(refreshStatus, 3000);
