// Single source of truth for the build stamp.
// SCHEME (2026-10-26, supersedes the date+letter suffix): each shipped build
// bumps the version's third number by one (1.2.0 -> 1.2.1 -> 1.2.2, ...),
// and BUILD tracks that version, so the stamp still changes on every build.
// Shown in the popup/options footers, baked into the page-cache key (so a
// code change can never serve a stale cached page), and read by build.sh
// for the release zip filename (version only, no suffix).
export const BUILD = '1.3.2';
