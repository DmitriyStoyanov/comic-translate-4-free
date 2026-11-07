// Translation backends. translateBlocks(blocks, settings) -> aligned [string].
// Empty source texts map to empty translations. Throws with a human message.
import { LANGS, TARGET_LANGS, updateSettingsField } from '../shared/settings.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
// Abort-aware sleep: rejects immediately on cancel instead of waiting out
// the full backoff delay.
function sleepAbortable(ms, signal) {
  if (!signal) return sleep(ms);
  if (signal.aborted) throw Object.assign(new Error('cancelled'), { cancelled: true });
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(t);
      reject(Object.assign(new Error('cancelled'), { cancelled: true }));
    };
    const t = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

// Fetch with timeout and retry for LM Studio (the flakiest backend).
// 10-min timeout per attempt; 2 retries with 2s/6s backoff on network
// errors and 5xx only (4xx are not retried).

// LM Studio host permission check. Manifest covers localhost/127.0.0.1;
// a LAN host (192.168.x.x) or remote URL needs an explicit grant. Check
// before fetching so the user gets an actionable error instead of a bare
// "Failed to fetch".
export function lmStudioHostPattern(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return null; // covered by manifest
    // Ensure IPv6 literals are bracketed in the permission pattern.
    // u.host is already bracketed for IPv6, but be explicit: an IPv6
    // address has 2+ colons (IPv4:port has exactly one).
    let h = u.host;
    const colons = (h.match(/:/g) || []).length;
    if (colons >= 2 && !h.startsWith('[')) {
      // Unbracketed IPv6 (with or without port) — bracket the address.
      const lastColon = h.lastIndexOf(':');
      const afterLast = h.slice(lastColon + 1);
      if (/^\d+$/.test(afterLast) && h.slice(0, lastColon).includes(':')) {
        h = `[${h.slice(0, lastColon)}]:${afterLast}`; // addr:port
      } else {
        h = `[${h}]`; // bare address
      }
    }
    return `${u.protocol}//${h}/*`;
  } catch { return null; }
}

export async function ensureLmStudioHostAccess(url) {
  const pattern = lmStudioHostPattern(url);
  if (!pattern) return; // localhost — manifest covers it
  let has = false;
  try {
    has = await chrome.permissions.contains({ origins: [pattern] });
  } catch { /* assume not granted */ }
  if (!has) {
    const host = (() => { try { return new URL(url).host; } catch { return url; } })();
    const err = new Error(`LM Studio: no permission to reach ${host}. Click "Grant host access" next to the server URL in Settings, then try again.`);
    err.needsHostGrant = true;
    err.hostPattern = pattern;
    throw err;
  }
}
// deadlineMs caps the TOTAL wall time across attempts + backoffs (default
// 30s — matching the Firefox worker deadline and Chrome's translate
// abort, so a hung server can't hold the worker past its kill). Callers
// thread their own deadline: the SW passes 30s on both browser paths.
async function lmStudioFetch(url, opts, signal, label, deadlineMs = 30000) {
  const deadline = Date.now() + deadlineMs;
  const backoffs = [1000, 2000, 4000];
  let lastErr = null;
  const timedOut = () => new Error('LM Studio: translate timed out');
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    let remaining = deadline - Date.now();
    if (remaining <= 0) throw timedOut();
    if (attempt > 0) {
      await sleepAbortable(Math.min(backoffs[attempt - 1], remaining), signal);
      remaining = deadline - Date.now();
      if (remaining <= 0) throw timedOut();
    }
    // Combine the caller's cancel signal with the per-attempt timeout
    // (capped by the remaining deadline).
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    if (signal) {
      if (signal.aborted) throw Object.assign(new Error('cancelled'), { cancelled: true });
      signal.addEventListener('abort', onAbort, { once: true });
    }
    const timer = setTimeout(() => ctrl.abort(), Math.min(60000, remaining));
    try {
      const resp = await fetch(url, { ...opts, signal: ctrl.signal });
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      // Retry on 5xx; 4xx are client errors (not retried).
      if (resp.status >= 500 && resp.status < 600 && attempt < backoffs.length) {
        lastErr = new Error(`LM Studio: HTTP ${resp.status} from ${label} (retrying)`);
        continue;
      }
      return resp;
    } catch (e) {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (e && e.cancelled) throw e;
      // Deadline hit while waiting: report the timeout, not "cannot reach"
      // — the server was reachable but too slow.
      if (Date.now() >= deadline) throw timedOut();
      // AbortError from timeout: retry if attempts remain.
      const isTimeout = e && e.name === 'AbortError' && !signal?.aborted;
      const isNetwork = e && (e.name === 'TypeError' || /fetch failed|cannot reach|network/i.test(String(e.message)));
      if ((isTimeout || isNetwork) && attempt < backoffs.length) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  // Attempts exhausted on timeouts: report the deadline, not "cannot reach".
  if (lastErr && lastErr.name === 'AbortError') throw timedOut();
  throw lastErr || new Error('LM Studio: request failed');
}

function langName(code) {
  const hit = LANGS.find(([c]) => c === code) || TARGET_LANGS.find(([c]) => c === code);
  return hit ? hit[1] : code;
}

async function googleFree(texts, src, dst, signal) {
  // The gtx endpoint is unofficial and rate-limits aggressively (HTTP 500 /
  // 429 in bursts). Requests run with a small worker pool (3 lanes) instead
  // of one-at-a-time; each lane keeps the original ~120ms pacing between its
  // own requests, so total rate is ~3x the old sequential rate, not Nx.
  const out = new Array(texts.length);
  let next = 0;
  async function lane() {
    for (;;) {
      const i = next++;
      if (i >= texts.length) return;
      out[i] = await googleOne(texts[i], src, dst, signal);
      await sleep(120); // per-lane pacing, as before
    }
  }
  const lanes = [];
  for (let k = 0; k < Math.min(3, texts.length); k++) lanes.push(lane());
  await Promise.all(lanes);
  return out;
}

async function googleOne(t, src, dst, signal) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx' +
    `&sl=${encodeURIComponent(src)}&tl=${encodeURIComponent(dst)}&dt=t&q=${encodeURIComponent(t)}`;
  // The gtx endpoint is unofficial and rate-limits aggressively (HTTP 500 /
  // 429 in bursts). One failure must not kill the whole page: retry with
  // exponential backoff + jitter before giving up on this text.
  const delays = [1500, 4000, 10000];
  let resp = null, lastErr = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      resp = await fetch(url, signal ? { signal } : undefined);
    } catch (e) {
      // Cancelled: don't burn the retry backoff on an aborted request —
      // surface the quiet 'cancelled' shape the pipeline expects.
      if (signal && signal.aborted) throw Object.assign(new Error('cancelled'), { cancelled: true });
      lastErr = e;
      resp = null;
    }
    if (resp && resp.ok) break;
    const retryable = !resp || resp.status === 429 || resp.status >= 500;
    if (!retryable || attempt === delays.length) break;
    const wait = delays[attempt] + Math.random() * 800;
    await sleepAbortable(wait, signal);
    resp = null;
  }
  if (!resp) throw new Error('google translate: network error — ' + String(lastErr).slice(0, 120));
  if (!resp.ok) {
    throw new Error(
      `google translate: HTTP ${resp.status} after retries (unofficial endpoint — ` +
      `Google is rate-limiting right now; wait a few minutes or switch to Azure / LM Studio)`);
  }
  const data = await resp.json();
  return (((data && data[0]) || []).map(seg => (seg && seg[0]) || '').join(''));
}

function azureLang(code) {
  // Same language, different code per backend (Google-style -> Azure).
  // ku is a semantic trap: Google's ku is Kurmanji, Azure's ku is Central
  // Kurdish (Sorani) — the mapping is mandatory, not cosmetic.
  // Source of truth for the 114 codes: TARGET_LANGS in shared/settings.js.
  // Verified against https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support
  const m = {
    'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant',
    pt: 'pt-pt', 'pt-BR': 'pt', 'pt-PT': 'pt-pt', 'fr-CA': 'fr-ca',
    sr: 'sr-Cyrl', mn: 'mn-Cyrl',
    ny: 'nya', lg: 'lug', rn: 'run',
    ku: 'kmr', ckb: 'ku',
  };
  const mapped = m[code] || code;
  // Safety net: if TARGET_LANGS gains a code Azure doesn't support, fail
  // fast with a clear message instead of sending a bad code (HTTP 400).
  if (!AZURE_SUPPORTED.has(mapped.toLowerCase())) {
    throw new Error(`Azure Translator does not support language "${code}" — pick Google or LM Studio for this target`);
  }
  return mapped;
}

// Azure Cloud Text-translation codes (lowercased). All 114 TARGET_LANGS
// codes map into this set via azureLang() above.
const AZURE_SUPPORTED = new Set(
  ('af sq am ar hy as az bn ba eu bho bs bg yue ca zh-Hans zh-Hant sn hr cs da ' +
   'dv doi nl en et fj fil fi fr fr-ca gl ka de el gu ht ha he hi hu is ig id ' +
   'ga it ja kn kk km rw gom ko ku kmr ky lo lv lt ln lug mk mai mg ms ml mt ' +
   'mi mr mn-Cyrl mn-Mong my ne nb nya or ps fa pl pt pt-pt pa ro run ru sm ' +
   'sr-Cyrl sr-Latn st nso tn sd si sk sl so es sw sv ta tt te th ti tr tk uk ' +
   'ur ug uz vi cy xh yo zu').toLowerCase().split(' ')
);

async function azure(texts, settings, signal) {
  const key = (settings.azureKey || '').trim();
  const region = (settings.azureRegion || '').trim();
  if (!key) throw new Error('azure translator: API key not set — add it in Settings');
  if (!region) throw new Error('azure translator: region not set — add it in Settings');
  const to = azureLang(settings.targetLang);
  // The 25-text batches used to run one at a time; now 3 batches fly in
  // parallel (official paid API — no rate-limit gentleness needed).
  const batches = [];
  for (let i = 0; i < texts.length; i += 25) batches.push(texts.slice(i, i + 25));
  const out = new Array(batches.length);
  let next = 0;
  async function lane() {
    for (;;) {
      const bi = next++;
      if (bi >= batches.length) return;
      out[bi] = await azureBatch(batches[bi], key, region, to);
    }
  }
  const lanes = [];
  for (let k = 0; k < Math.min(3, batches.length); k++) lanes.push(lane());
  await Promise.all(lanes);

  async function azureBatch(batch, key, region, to) {
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${encodeURIComponent(to)}`;
    // Like the Google path: one throttled batch (429/5xx) must not kill the
    // whole page. Retry with exponential backoff + jitter.
    const delays = [1500, 4000, 10000];
    let resp = null, lastErr = null;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Ocp-Apim-Subscription-Region': region,
            'Content-type': 'application/json',
            'X-ClientTraceId': crypto.randomUUID(),
          },
          body: JSON.stringify(batch.map(t => ({ text: t }))),
          ...(signal ? { signal } : {}),
        });
      } catch (e) {
        if (signal && signal.aborted) throw Object.assign(new Error('cancelled'), { cancelled: true });
        lastErr = e;
        resp = null;
      }
      if (resp && resp.ok) break;
      const retryable = !resp || resp.status === 429 || resp.status >= 500;
      if (!retryable || attempt === delays.length) break;
      await sleepAbortable(delays[attempt] + Math.random() * 800, signal);
      resp = null;
    }
    if (!resp) throw new Error('azure translator: network error — ' + String(lastErr).slice(0, 120));
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`azure translator: HTTP ${resp.status} after retries ${body.slice(0, 160)}`);
    }
    const data = await resp.json();
    const r = [];
    for (const d of data) r.push((d.translations && d.translations[0] && d.translations[0].text) || '');
    return r;
  }

  return out.flat();
}

function lmStudioBase(settings) {
  return (settings.lmStudioUrl || 'http://127.0.0.1:1234').replace(/\/+$/, '');
}

// Which server API the user points at. The two flavours differ in path,
// request shape and reply envelope:
// 'openai': POST <url>/chat/completions with {messages, temperature, ...},
//   reply {choices:[{message:{content}}]}. LM Studio mounts this under /v1,
//   so a bare host:port URL gets /v1 added; a URL that already carries a path
//   is left alone (a non-LM-Studio server with its own mount point).
// 'lmstudio-v1': POST <server-root>/api/v1/chat with {model, input},
//   reply {output:[{type:"reasoning"|"message", content}]}. `model` is required,
//   so it is auto-detected from /api/v1/models (the /v1 prefix the URL field
//   carries is the OpenAI-compat mount; the native REST API lives at the
//   server root, so it is stripped).
function lmStudioEndpoints(settings) {
  const url = lmStudioBase(settings);
  if ((settings.lmStudioApi || 'lmstudio-v1') === 'lmstudio-v1') {
    const root = url.replace(/\/v1$/, '');
    return { chat: root + '/api/v1/chat', models: root + '/api/v1/models', label: 'LM Studio REST API v1', flavor: 'lmstudio-v1' };
  }
  const afterHost = url.replace(/^https?:\/\/[^/]+/i, '');
  const base = afterHost === '' ? url + '/v1' : url;
  return { chat: base + '/chat/completions', models: base + '/models', label: 'OpenAI-compatible', flavor: 'openai' };
}

// The native v1 API requires a `model` id on every chat request, but the
// translation flow must not interrogate the server first — it just asks the
// running model to translate. So the loaded model is learned once (from the
// connection check, or lazily on the first translation) and remembered in
// settings; later translations send a single POST. If the remembered model
// is gone (unloaded/swapped in LM Studio), the caller rediscovers once and
// retries. Prefers the native v1 shape (key + loaded_instances), falls back
// to older {id, state} shapes.
async function lmStudioDiscoverModel(ep, headers, signal, deadlineMs) {
  await ensureLmStudioHostAccess(ep.models);
  let resp;
  try {
    resp = await lmStudioFetch(ep.models, { headers }, signal, 'model discovery', deadlineMs);
  } catch (e) {
    if (e && e.cancelled) throw e;
    throw new Error('LM Studio: cannot reach ' + ep.models + ' — is the server running?');
  }
  if (!resp.ok) throw new Error(`LM Studio: HTTP ${resp.status} from ${ep.models}`);
  const data = await resp.json().catch(() => ({}));
  const models = (data && (data.data || data.models)) || [];
  const loaded = models.find(m => m && Array.isArray(m.loaded_instances) && m.loaded_instances.length > 0 && (m.key || m.id))
    || models.find(m => m && m.state === 'loaded' && (m.key || m.id));
  // No loaded model: say so plainly rather than JIT-loading some arbitrary
  // downloaded model the user didn't ask for.
  if (!loaded) throw new Error('LM Studio: no model is loaded — load one in LM Studio first, then translate again');
  const id = loaded.key || loaded.id;
  try {
    await updateSettingsField('lmStudioModelId', id);
  } catch { /* remembering is best-effort; the id is still returned */ }
  return id;
}

// LM Studio's OpenAI-compatible server (user hosts the model themselves).
// One batched request for all texts. The prompt follows the contract from
// jameslee0623/ComicTranslate (src/background/lensLocalEngine.js): the
// instruction is the first line, outside any JSON, then the source strings as
// a JSON array (OCR text can contain newlines/quotes, so line-based framing
// would shift entries). `texts`/`target`/`source` ride along for chat servers
// that are actually dedicated translators; a general LLM ignores them and
// obeys the prompt. temperature 0: a re-read of the same page must give the
// same translation.
function lmStudioPrompt(texts, settings) {
  const n = texts.length;
  const from = langName(settings.sourceLang);
  const to = langName(settings.targetLang);
  return 'Translate the following ' + n + ' text(s) from ' + from + ' to ' + to +
    '. Reply with ONLY a JSON array of ' + n +
    ' translated strings, in the same order, no explanations, no code fences.' +
    ' Do not analyse the text and do not think step by step: output the array' +
    ' itself as your very first characters, then stop.' +
    '\n' + JSON.stringify(texts);
}

async function lmStudio(texts, settings, signal, deadlineMs) {
  const ep = lmStudioEndpoints(settings);
  await ensureLmStudioHostAccess(ep.chat);
  const headers = { 'Content-Type': 'application/json' };
  if ((settings.lmStudioKey || '').trim()) headers['Authorization'] = 'Bearer ' + settings.lmStudioKey.trim();
  if (ep.flavor === 'lmstudio-v1') return lmStudioV1(texts, settings, ep, headers, signal, deadlineMs);
  const body = {
    messages: [{ role: 'user', content: lmStudioPrompt(texts, settings) }],
    temperature: 0,
    texts,
    target: settings.targetLang,
  };
  if (settings.sourceLang && settings.sourceLang !== 'auto') body.source = settings.sourceLang;
  let resp;
  try {
    resp = await lmStudioFetch(ep.chat, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }, signal, 'chat', deadlineMs);
  } catch (e) {
    if (e && e.cancelled) throw e;
    throw new Error('LM Studio: cannot reach ' + ep.chat + ' (' + ep.label + ') — is the server running? (' + String(e).slice(0, 100) + ')');
  }
  // Read as text, not res.json(): the reply is not reliably JSON, an error
  // status carries the real reason in its body, and json() consumes the stream
  // even when the parse then throws.
  const bodyText = await resp.text().catch(() => '');
  if (!resp.ok) {
    throw new Error(`LM Studio: HTTP ${resp.status} — ${bodyText.slice(0, 160) || 'check the server URL'}`);
  }
  return parseLmStudioBody(bodyText, texts.length);
}

// Native REST API v1 translation: one POST per page, {model, input,
// temperature}. The model id is the remembered one when we have it; learned
// once when we don't; re-learned once if the remembered one fails (the user
// may have swapped models in LM Studio since).
async function lmStudioV1(texts, settings, ep, headers, signal, deadlineMs) {
  const input = lmStudioPrompt(texts, settings);
  const post = async (modelId) => {
    try {
      return await lmStudioFetch(ep.chat, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: modelId, input, temperature: 0 }),
      }, signal, 'v1 chat', deadlineMs);
    } catch (e) {
      if (e && e.cancelled) throw e;
      throw new Error('LM Studio: cannot reach ' + ep.chat + ' — is the server running? (' + String(e).slice(0, 100) + ')');
    }
  };
  const fail = async (resp) => {
    const t = await resp.text().catch(() => '');
    throw new Error(`LM Studio: HTTP ${resp.status} — ${t.slice(0, 160) || 'check the server URL'}`);
  };
  const n = texts.length;
  let modelId = settings.lmStudioModelId;
  if (!modelId) {
    const resp = await post(await lmStudioDiscoverModel(ep, headers, signal, deadlineMs));
    if (!resp.ok) await fail(resp);
    return parseLmStudioBody(await resp.text(), n);
  }
  let resp = await post(modelId);
  if (!resp.ok) {
    resp = await post(await lmStudioDiscoverModel(ep, headers, signal, deadlineMs));
    if (!resp.ok) await fail(resp);
  }
  return parseLmStudioBody(await resp.text(), n);
}

// --- LM Studio reply parsing (ported from lensLocalEngine.js in the author's own
// project jameslee0623/ComicTranslate — no third-party license obligation)
// Index alignment is the whole contract: entry i translates region i. A length
// mismatch is an error, never a zip — silently pairing the wrong strings
// paints plausible nonsense into speech bubbles.

// Brace-balance scan for a [...] window that JSON.parses. A regex cannot do
// this: quoted strings are skipped (brackets inside text must not throw the
// depth count) and escapes are honoured. Of several parseable windows the LAST
// one with exactly `expected` entries wins — a reasoning model repeats its
// draft and then restates the final version. Without a count the longest
// parseable window wins.
function lmExtractJsonArray(raw, expected) {
  let best = null, exact = null;
  const counted = typeof expected === 'number' && expected >= 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== '[') continue;
    let depth = 0, inString = false, escaped = false;
    for (let j = i; j < raw.length; j++) {
      const c = raw[j];
      if (inString) {
        if (escaped) { escaped = false; continue; }
        if (c === '\\') { escaped = true; continue; }
        if (c === '"') inString = false;
        continue;
      }
      if (c === '"') { inString = true; continue; }
      if (c === '[') depth++;
      else if (c === ']') {
        depth--;
        if (depth === 0) {
          const candidate = raw.slice(i, j + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (counted && Array.isArray(parsed) && parsed.length === expected) {
              exact = { candidate, parsed };
            } else if (!best || candidate.length > best.candidate.length) {
              best = { candidate, parsed };
            }
          } catch { /* this window is prose, keep scanning */ }
          break;
        }
      }
    }
  }
  return exact || best;
}

// Pull the assistant's ANSWER out of a chat envelope, or null when this is
// not one. Reasoning models (Qwen3, Gemma, DeepSeek-R1, ...) carry two pieces
// of text: the reasoning half quotes the input back — including the ORIGINAL
// JSON array of source strings — so scanning the whole body for an array would
// find the untranslated original first. Only the answer half is a candidate.
function lmUnwrapAssistantText(data) {
  if (!data || typeof data !== 'object') return null;
  // LM Studio native: keep only the answer items, never the reasoning ones.
  if (Array.isArray(data.output)) {
    const parts = data.output
      .filter(o => o && (o.type === 'message' || o.type === 'text'))
      .map(o => String(o.content === undefined ? '' : o.content));
    return parts.length ? parts.join('\n') : null;
  }
  // OpenAI-compatible.
  if (Array.isArray(data.choices) && data.choices.length) {
    const msg = data.choices[0] && data.choices[0].message;
    if (msg && typeof msg.content === 'string' && msg.content.trim()) return msg.content;
    return null;
  }
  // Ollama.
  if (data.message && typeof data.message.content === 'string' && data.message.content.trim()) {
    return data.message.content;
  }
  return null;
}

// The model's SCRATCH text when the server split it out of the answer, or
// null. LM Studio can return HTTP 200 with an empty message.content and the
// whole reply in reasoning_content (LM Studio bug #1602) — the work is done,
// so it is recovered, but ONLY via an array of exactly `expected` entries:
// reading this field without a count could paint the quoted-back source text
// over every bubble.
function lmReasoningText(data) {
  if (!data || typeof data !== 'object') return null;
  const boxes = [];
  if (Array.isArray(data.choices) && data.choices.length) boxes.push(data.choices[0] && data.choices[0].message);
  boxes.push(data.message, data);
  for (const box of boxes) {
    if (!box || typeof box !== 'object') continue;
    for (const key of ['reasoning_content', 'reasoning', 'thinking']) {
      if (typeof box[key] === 'string' && box[key].trim()) return box[key];
    }
  }
  if (Array.isArray(data.output)) {
    const parts = data.output
      .filter(o => o && o.type === 'reasoning')
      .map(o => String(o.content === undefined ? '' : o.content));
    if (parts.length && parts.join('').trim()) return parts.join('\n');
  }
  return null;
}

// The server's own error text, when it reported one in a body. LM Studio
// answers an unknown route with HTTP 200 and {"error":"Unexpected endpoint or
// method. ..."} — surfacing it verbatim beats reporting a parsing bug.
function lmServerErrorMessage(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.translations || data.result) return null; // a real payload
  for (const key of ['error', 'detail', 'message', 'msg']) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object' && typeof v.message === 'string' && v.message.trim()) return v.message.trim();
  }
  return null;
}

function lmNormalizeTranslations(data, expected) {
  let list = null;
  if (Array.isArray(data)) list = data;
  else if (data && Array.isArray(data.translations)) list = data.translations;
  else if (data && Array.isArray(data.result)) list = data.result;
  if (list === null) {
    throw new Error('LM Studio reply has no translations array. Expected a JSON array of ' + expected + ' translated strings.');
  }
  if (typeof expected === 'number' && list.length !== expected) {
    throw new Error('LM Studio returned ' + list.length + ' translation(s) for ' + expected +
      ' source line(s) — refusing to pair them, because shifted entries would paint the wrong text into the wrong bubble.');
  }
  return list.map(v => (v === null || v === undefined ? '' : String(v)));
}

function parseLmStudioBody(bodyText, expected) {
  const text = bodyText === null || bodyText === undefined ? '' : String(bodyText);
  if (!text.trim()) {
    throw new Error('LM Studio reply was empty. Is a model loaded in LM Studio?');
  }
  let parsedBody;
  try { parsedBody = JSON.parse(text); } catch { parsedBody = undefined; }

  let data = null;
  if (parsedBody !== undefined) {
    const answer = lmUnwrapAssistantText(parsedBody);
    if (answer !== null) {
      // A chat envelope. The answer is a STRING that may itself be JSON, may
      // be code-fenced, may carry prose — so parse that string, with `expected`
      // so a reply that also quotes the source back resolves to the array with
      // the right number of entries.
      try {
        data = JSON.parse(answer);
      } catch {
        const found = lmExtractJsonArray(answer, expected);
        data = found ? found.parsed : null;
      }
    } else {
      // Not an envelope: a dedicated translation server answering
      // {"translations":[...]} or a bare array — but surface its own error
      // text first.
      const reported = lmServerErrorMessage(parsedBody);
      if (reported) throw new Error('LM Studio reported: ' + reported);
      // An envelope whose ANSWER is empty: a reasoning model that put the whole
      // reply in its thinking half. Recoverable only with the exact count.
      const think = lmReasoningText(parsedBody);
      if (think !== null) {
        const found = typeof expected === 'number' ? lmExtractJsonArray(think, expected) : null;
        if (found && Array.isArray(found.parsed) && found.parsed.length === expected) {
          return lmNormalizeTranslations(found.parsed, expected);
        }
        throw new Error('LM Studio spent its whole reply thinking and left the answer empty — nothing was translated. ' +
          'Try switching off "Separate reasoning_content and content in API responses" in LM Studio Developer settings, or pick a non-reasoning model.');
      }
      data = parsedBody;
    }
  } else {
    // Not JSON at all: a raw completion that wrapped the array in prose or a
    // code fence.
    const found = lmExtractJsonArray(text, expected);
    data = found ? found.parsed : null;
  }
  if (data === null || data === undefined) {
    throw new Error('LM Studio reply was not valid JSON. Expected a JSON array of ' + expected + ' translated strings.');
  }
  return lmNormalizeTranslations(data, expected);
}

export async function checkLmStudio(settings) {
  const ep = lmStudioEndpoints(settings);
  let resp;
  try {
    resp = await fetch(ep.models);
  } catch (e) {
    return { ok: false, error: 'cannot reach ' + ep.models + ' (' + ep.label + ') — start the LM Studio server first' };
  }
  if (!resp.ok) return { ok: false, error: `HTTP ${resp.status} from ${ep.models}` };
  const data = await resp.json().catch(() => ({}));
  const models = (data && (data.data || data.models)) || [];
  const names = models.map(m => m.key || m.id).filter(Boolean);
  if (ep.flavor === 'lmstudio-v1') {
    // Remember the loaded model now, so translations just send one POST.
    const loaded = models.find(m => m && Array.isArray(m.loaded_instances) && m.loaded_instances.length > 0 && (m.key || m.id));
    if (loaded) {
      try {
        await updateSettingsField('lmStudioModelId', loaded.key || loaded.id);
      } catch { /* best-effort */ }
    }
  }
  return {
    ok: true,
    detail: names.length
      ? `connected (${ep.label}) — ${names.length} model${names.length > 1 ? 's' : ''} loaded: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}`
      : `connected (${ep.label}) — but no model is loaded in LM Studio`,
  };
}

export async function checkAzure(settings) {
  const key = (settings.azureKey || '').trim();
  const region = (settings.azureRegion || '').trim();
  if (!key) return { ok: false, error: 'API key not set' };
  if (!region) return { ok: false, error: 'region not set' };
  try {
    // Minimal real call: translate one word. A 200 proves key+region+network.
    const url = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=en`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Ocp-Apim-Subscription-Region': region,
        'Content-type': 'application/json',
        'X-ClientTraceId': crypto.randomUUID(),
      },
      body: JSON.stringify([{ text: 'test' }]),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return { ok: false, error: `HTTP ${resp.status} ${body.slice(0, 120)}` };
    }
    return { ok: true, detail: 'connected — key and region accepted' };
  } catch (e) {
    return { ok: false, error: 'network error — ' + String(e).slice(0, 120) };
  }
}
async function localLlm(texts, settings, signal) {
  // WebLLM runtime removed from the bundle (was 6.6 MB). A stale stored
  // 'local-llm' pref falls back to Google instead of hard-failing.
  return googleFree(texts, settings.sourceLang, settings.targetLang, signal);
}

export async function translateBlocks(blocks, settings, onProgress, signal, deadlineMs = 30000, isUserCancelled) {
  const idx = [], texts = [];
  // List-like blocks (ragged entries, e.g. a table of contents) are sent line by
  // line so entries are not merged into one sentence; `spans` maps each block
  // back to its slice of `texts`.
  const spans = [];
  blocks.forEach((b, i) => {
    if (!(b.text && b.text.trim())) return;
    idx.push(i);
    const lines = b.list_like && Array.isArray(b.text_lines) ? b.text_lines : null;
    if (lines && lines.length > 1) {
      spans.push([texts.length, lines.length]);
      texts.push(...lines);
    } else {
      spans.push([texts.length, 1]);
      texts.push(b.text);
    }
  });
  const translated = new Array(blocks.length).fill('');
  if (!texts.length) return translated;
  const backend = settings.translationBackend || 'google';
  const translateStart = performance.now();
  const runBackend = async (b, attemptDeadlineMs, sig = signal) => {
    if (b === 'azure') return await azure(texts, settings, sig);
    if (b === 'lmstudio') return await lmStudio(texts, settings, sig, attemptDeadlineMs ?? deadlineMs);
    if (b === 'local-llm') return await localLlm(texts, settings, sig);
    return await googleFree(texts, settings.sourceLang, settings.targetLang, sig);
  };
  let results;
  let lastErr = null;
  let backendUsed = backend;
  let azureConsumed = false;
  try {
    results = await runBackend(backend);
  } catch (e) {
    // Only a real user cancel skips failover. A timeout-abort is also
    // marked 'cancelled' by the backend helpers, but it must still fail
    // over — otherwise a stalled backend never switches to Azure.
    if (isUserCancelled?.()) throw e;
    lastErr = e;
    // Opt-in failover: try the next backend. Never silently fail over to
    // paid Azure without the opt-in — the setting gates it.
    if (settings.backendFailover) {
      const azureConfigured = !!(settings.azureKey || '').trim();
      // Failover order: prefer free/local backends first, then Azure if configured.
      const candidates = [];
      if (backend !== 'google') candidates.push('google');
      if (backend !== 'lmstudio') candidates.push('lmstudio');
      if (azureConfigured && backend !== 'azure') candidates.push('azure');
      // If the primary died by timeout-abort, the caller's signal is dead:
      // failover attempts on it would die instantly. Rescue on a fresh
      // signal with its own 20s budget, so stall (30s) + rescue fits
      // under the caller's 60s backstop. A user cancel during rescue
      // still stops it via the loop-top check below.
      const rescueMode = signal?.aborted && !isUserCancelled?.();
      const failoverBudgetMs = rescueMode ? 20000 : deadlineMs;
      const budgetStart = rescueMode ? performance.now() : translateStart;
      let attemptSignal = signal;
      let failoverTimer = null;
      let failoverAttempted = false;
      if (rescueMode) {
        const fc = new AbortController();
        attemptSignal = fc.signal;
        failoverTimer = setTimeout(() => { try { fc.abort(); } catch {} }, failoverBudgetMs);
      }
      // Failover must fit inside the same overall budget: a slow middle
      // backend (a running LM Studio server generating slowly) used to burn
      // the whole deadline, so later backends never got a turn and the
      // overall abort then poisoned their attempts too. Cap each LM Studio
      // failover attempt at 15s and stop when the budget is gone, so Azure
      // always gets its turn inside the 30s translate budget.
      const FAILOVER_LM_DEADLINE_MS = 15000;
      for (const fb of candidates) {
        const remaining = failoverBudgetMs - (performance.now() - budgetStart);
        if (remaining <= 0) break;
        if (isUserCancelled?.()) {
          if (failoverTimer) clearTimeout(failoverTimer);
          throw Object.assign(new Error('cancelled'), { cancelled: true });
        }
        failoverAttempted = true;
        try {
          // Skip LM Studio failover if it was the failing backend (avoid loop).
          // Skip backends that need config we don't have.
          if (fb === 'lmstudio' && backend === 'lmstudio') continue;
          // User-visible notice: failover must not happen silently.
          onProgress && onProgress({ failoverFrom: backend, failoverTo: fb });
          results = await runBackend(fb, fb === 'lmstudio' ? Math.min(remaining, FAILOVER_LM_DEADLINE_MS) : undefined, attemptSignal);
          if (isUserCancelled?.()) {
            if (failoverTimer) clearTimeout(failoverTimer);
            throw Object.assign(new Error('cancelled'), { cancelled: true });
          }
          lastErr = null;
          backendUsed = fb;
          if (fb === 'azure') azureConsumed = true;
          console.warn(`[ct] backend failover: ${backend} failed, ${fb} succeeded`);
          break;
        } catch (fe) {
          if (isUserCancelled?.()) throw fe;
          lastErr = fe;
          if (fb === 'azure') azureConsumed = true;
        }
      }
      if (failoverTimer) clearTimeout(failoverTimer);
      // A timeout-abort that failover couldn't rescue must not surface as
      // a bare 'cancelled'. No failover attempted keeps the old
      // 'timed out after Xs' wording; a rescued-then-failed run says so.
      if (lastErr && lastErr.cancelled && !isUserCancelled?.()) {
        lastErr = failoverAttempted
          ? new Error('translation failed: all backends failed or timed out')
          : new Error(`translate timed out after ${deadlineMs / 1000}s — the translation backend may be stuck`);
      }
      // Failover ran but Azure was never a candidate (no key): say so
      // plainly, so the user isn't left wondering why it didn't switch.
      // Settings are per-browser — a key entered in Chrome is not present
      // in Firefox.
      if (lastErr && !azureConfigured && backend !== 'azure') {
        lastErr.message = `${lastErr.message} — Azure was not tried: no API key in this browser's settings`;
      }
      // Failover already tried Azure (and it failed): don't offer a
      // "retry with Azure" — it was just consumed.
      if (lastErr && azureConsumed) lastErr.azureRetryAvailable = false;
    } else {
      // Not opted in: don't fail over automatically, but tag the error so
      // the UI can offer one-click "retry with Azure".
      if ((settings.azureKey || '').trim() && backend !== 'azure') {
        lastErr.azureRetryAvailable = true;
      }
      // A timeout-abort (not a user cancel) must surface as a timeout
      // error, not a bare 'cancelled' — otherwise the run looks cancelled
      // and shows no error message at all (Chrome regression in 1018o).
      if (lastErr && lastErr.cancelled && !isUserCancelled?.()) {
        const t = new Error(`translate timed out after ${deadlineMs / 1000}s — the translation backend may be stuck`);
        t.azureRetryAvailable = lastErr.azureRetryAvailable;
        lastErr = t;
      }
    }
    if (lastErr) throw lastErr;
  }
  spans.forEach(([start, n], k) => {
    translated[idx[k]] = results.slice(start, start + n).map(t => String(t || '').replace(/\s*\n\s*/g, ' ').trim()).join('\n');
  });
  // Record which backend produced the translation (surfaced in debug rows).
  blocks.forEach(b => { b.backendUsed = backendUsed; });
  onProgress && onProgress();
  return translated;
}

export const BACKEND_LABEL = { google: 'Google (free)', azure: 'Azure Translator', lmstudio: 'LM Studio (local)', 'local-llm': 'Local LLM (experimental)' };
// Short labels for the status pill (it has room for one word, not a sentence).
export const BACKEND_SHORT_LABEL = { google: 'Google', azure: 'Azure', lmstudio: 'LM Studio', 'local-llm': 'Local LLM' };
