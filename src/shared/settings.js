// Shared settings: defaults + storage access. Importable in SW, offscreen, UI pages.
// (Content scripts use chrome.storage directly via messaging to avoid duplication.)

export const DEFAULT_SETTINGS = {
  sourceLang: 'auto', // 'auto' = detect from the OCR'd text; or 'ja' | 'en' | 'it' | 'zh-CN' | 'zh-TW'
  targetLang: 'en',
  translationBackend: 'google', // 'google' | 'azure' | 'lmstudio' | 'local-llm'
  backendFailover: true, // if the selected backend fails, try another (default on, 2026-10-26)
  azureKey: '',
  azureRegion: '',
  lmStudioUrl: 'http://127.0.0.1:1234', // LM Studio server (bare host:port; flavour adds its path)
  lmStudioKey: '',
  lmStudioApi: 'lmstudio-v1', // 'openai' | 'lmstudio-v1' (LM Studio REST)
  translateTimeoutSec: 120, // translation deadline (30-600s); slow local LLMs may need more
  lmStudioModelId: '', // auto-managed: loaded model id for the v1 flavour (no UI)
  localLlmModel: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
  debugMode: false,
  detectionThreshold: 0.3,
  minImageSize: 500, // skip images smaller than this (max dimension, px)
  siteWhitelist: [], // hostnames with site access, e.g. ['example.com']
  allowAllSites: false, // site access: translate on any site (requests <all_urls> when enabled)
  autoTranslateOnLoad: true, // start the pipeline automatically on allowed page loads
  displayMode: 'page', // 'page' = whole translated image | 'interactive' = original image, click a bubble to reveal its translation
  playDing: true, // play a chime when a translation finishes (toggle in Settings)
  firstRun: false, // transient: set true by onInstalled, consumed by the popup to show the models section once
};

export const LANGS = [
  ['ja', 'Japanese'], ['en', 'English'], ['it', 'Italian'],
  ['zh-CN', 'Chinese (Simplified)'], ['zh-TW', 'Chinese (Traditional)'],
];

// Native names for the source-language dropdowns in popup/options UI.
export const NATIVE_LANGS = [
  ['ja', '日本語'], ['en', 'English'], ['it', 'Italiano'],
  ['zh-CN', '简体中文'], ['zh-TW', '繁體中文'],
];

// Every language both Google Translate and Azure Translator support
// (intersection verified 2026-09-28). Google-style codes, matching LANGS.
export const TARGET_LANGS = [

  ['en', 'English'],
  ['af', 'Afrikaans'],
  ['sq', 'Albanian'],
  ['am', 'Amharic'],
  ['ar', 'Arabic'],
  ['hy', 'Armenian'],
  ['as', 'Assamese'],
  ['az', 'Azerbaijani'],
  ['ba', 'Bashkir'],
  ['eu', 'Basque'],
  ['bn', 'Bengali'],
  ['bho', 'Bhojpuri'],
  ['bs', 'Bosnian'],
  ['bg', 'Bulgarian'],
  ['yue', 'Cantonese'],
  ['ca', 'Catalan'],
  ['ny', 'Chichewa'],
  ['zh-CN', 'Chinese (Simplified)'],
  ['zh-TW', 'Chinese (Traditional)'],
  ['hr', 'Croatian'],
  ['cs', 'Czech'],
  ['da', 'Danish'],
  ['dv', 'Divehi'],
  ['doi', 'Dogri'],
  ['nl', 'Dutch'],
  ['et', 'Estonian'],
  ['fj', 'Fijian'],
  ['fil', 'Filipino'],
  ['fi', 'Finnish'],
  ['fr', 'French'],
  ['fr-CA', 'French (Canada)'],
  ['gl', 'Galician'],
  ['ka', 'Georgian'],
  ['de', 'German'],
  ['el', 'Greek'],
  ['gu', 'Gujarati'],
  ['ht', 'Haitian Creole'],
  ['ha', 'Hausa'],
  ['he', 'Hebrew'],
  ['hi', 'Hindi'],
  ['hu', 'Hungarian'],
  ['is', 'Icelandic'],
  ['ig', 'Igbo'],
  ['id', 'Indonesian'],
  ['ga', 'Irish'],
  ['it', 'Italian'],
  ['ja', 'Japanese'],
  ['kn', 'Kannada'],
  ['kk', 'Kazakh'],
  ['km', 'Khmer'],
  ['rw', 'Kinyarwanda'],
  ['gom', 'Konkani'],
  ['ko', 'Korean'],
  ['ku', 'Kurdish (Kurmanji)'],
  ['ckb', 'Kurdish (Sorani)'],
  ['ky', 'Kyrgyz'],
  ['lo', 'Lao'],
  ['lv', 'Latvian'],
  ['lt', 'Lithuanian'],
  ['ln', 'Lingala'],
  ['lg', 'Luganda'],
  ['mk', 'Macedonian'],
  ['mai', 'Maithili'],
  ['mg', 'Malagasy'],
  ['ms', 'Malay'],
  ['ml', 'Malayalam'],
  ['mt', 'Maltese'],
  ['mi', 'Maori'],
  ['mr', 'Marathi'],
  ['mn', 'Mongolian'],
  ['my', 'Myanmar (Burmese)'],
  ['ne', 'Nepali'],
  ['nso', 'Northern Sotho'],
  ['nb', 'Norwegian'],
  ['or', 'Odia'],
  ['ps', 'Pashto'],
  ['fa', 'Persian'],
  ['pl', 'Polish'],
  ['pt', 'Portuguese'],
  ['pt-BR', 'Portuguese (Brazil)'],
  ['pt-PT', 'Portuguese (Portugal)'],
  ['pa', 'Punjabi'],
  ['ro', 'Romanian'],
  ['rn', 'Rundi'],
  ['ru', 'Russian'],
  ['sm', 'Samoan'],
  ['sr', 'Serbian'],
  ['st', 'Sesotho'],
  ['sn', 'Shona'],
  ['sd', 'Sindhi'],
  ['si', 'Sinhala'],
  ['sk', 'Slovak'],
  ['sl', 'Slovenian'],
  ['so', 'Somali'],
  ['es', 'Spanish'],
  ['sw', 'Swahili'],
  ['sv', 'Swedish'],
  ['ta', 'Tamil'],
  ['tt', 'Tatar'],
  ['te', 'Telugu'],
  ['th', 'Thai'],
  ['ti', 'Tigrinya'],
  ['tn', 'Tswana'],
  ['tr', 'Turkish'],
  ['tk', 'Turkmen'],
  ['uk', 'Ukrainian'],
  ['ur', 'Urdu'],
  ['ug', 'Uyghur'],
  ['uz', 'Uzbek'],
  ['vi', 'Vietnamese'],
  ['cy', 'Welsh'],
  ['xh', 'Xhosa'],
  ['yo', 'Yoruba'],
  ['zu', 'Zulu'],
];

// Raw settings read: merged with defaults, no migrations or validation.
// Use for UI reads; getSettings() below is the validated pipeline read.
export async function readSettingsRaw() {
  const stored = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

// Serialized settings write: read-modify-write chained so concurrent
// callers don't clobber each other (the translators.js lmStudioModelId
// write-back raced the popup's writes before this).
// NOTE: the chain is per-JS-context — the SW, popup, and options page each
// have their own. Concurrent writes from DIFFERENT contexts can still race.
// Keep full-patch writes rare (user-initiated saves); hot single-field
// write-backs should use updateSettingsField() below.
let settingsWriteChain = Promise.resolve();
export function updateSettings(patch) {
  const w = settingsWriteChain.then(async () => {
    const s = await readSettingsRaw();
    await chrome.storage.local.set({ settings: { ...s, ...patch } });
  }).catch(() => {});
  settingsWriteChain = w;
  return w;
}

// Single-field write-back for cross-context hot paths (e.g. translators.js
// persisting the discovered lmStudioModelId while the popup may be saving).
// Reads fresh at write time and changes ONLY that field, so at worst we
// overwrite with near-current data instead of a stale snapshot.
export async function updateSettingsField(key, value) {
  const s = await readSettingsRaw();
  await chrome.storage.local.set({ settings: { ...s, [key]: value } });
}

export async function getSettings() {
  const stored = await chrome.storage.local.get('settings');
  const s = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  // One-time migration: the default minimum image size dropped 600 -> 500.
  // Installs still sitting on the old default follow it; a value the user
  // deliberately chose is left alone.
  if (stored.settings && stored.settings.minImageSize === 600) {
    s.minImageSize = 500;
    chrome.storage.local.set({ settings: s }).catch(() => {});
  }
  // One-time migration (2026-09-28): Latin/Russian source languages were
  // removed. A stored sourceLang that's no longer offered falls back to
  // the default; the orphaned OCR models are deleted.
  // 'auto' must be in the offered set (source auto-detect, 2026-10-05):
  // without it the default itself fails validation and every getSettings()
  // writes storage, which re-fires onChanged -> infinite write loop.
  const offered = new Set(['auto', ...LANGS.map(([code]) => code)]);
  if (s.sourceLang && !offered.has(s.sourceLang)) {
    s.sourceLang = DEFAULT_SETTINGS.sourceLang;
    chrome.storage.local.set({ settings: s }).catch(() => {});
  }
  // Target languages are now the Google∩Azure intersection (2026-09-28).
  // A stored targetLang that's not in the list falls back to English.
  if (s.targetLang && !TARGET_LANGS.some(([code]) => code === s.targetLang)) {
    s.targetLang = DEFAULT_SETTINGS.targetLang;
    chrome.storage.local.set({ settings: s }).catch(() => {});
  }
  // Prune removed models. Tracks which IDs were pruned so newly added
  // removals are picked up on installs where an earlier prune already ran.
  try {
    const { PRUNED_MODEL_IDS, pruneModelIds } = await import('./model-specs.js');
    const doneIds = Array.isArray(s._prunedModelIds) ? s._prunedModelIds : [];
    const pending = PRUNED_MODEL_IDS.filter(id => !doneIds.includes(id));
    if (pending.length) {
      await pruneModelIds(pending);
      s._prunedModelIds = [...new Set([...doneIds, ...pending])];
      chrome.storage.local.set({ settings: s }).catch(() => {});
    }
  } catch { /* best effort */ }
  // Safety-net clamps (mirrors options.js validNum): stored values are
  // trusted, but a corrupt write must never produce NaN thresholds or
  // absurd sizes downstream. No storage write here — just sanitize the read.
  const clamp = (v, lo, hi, fb) => Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;
  s.detectionThreshold = clamp(+s.detectionThreshold, 0.05, 0.9, DEFAULT_SETTINGS.detectionThreshold);
  s.minImageSize = Math.round(clamp(+s.minImageSize, 100, 4000, DEFAULT_SETTINGS.minImageSize));
  return s;
}
