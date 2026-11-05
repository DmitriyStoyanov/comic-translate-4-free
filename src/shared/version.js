// Build stamp for the source tree. The source tree follows the Chrome
// manifest (the repo root manifest is Chrome's), so BUILD here is the
// Chrome version. SPLIT (2026-11-03): Chrome and Firefox versions are
// independent now — Chrome 2.x (GPU speed line), Firefox 1.4.x (needed
// patches only). build.sh sets BUILD in each built copy to that browser's
// manifest version, so the popup/options footer and the page-cache key
// match the manifest for that browser. Do not rely on this source value
// for Firefox; the Firefox zip's BUILD is set by build.sh.
// Shown in the popup/options footers, baked into the page-cache key (so a
// code change can never serve a stale cached page).
export const BUILD = '2.0.11';
