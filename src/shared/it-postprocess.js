// Italian OCR clean-up, run on PP-OCR output when the source language is
// Italian. The recogniser reads hand-lettered comic balloons well letter by
// letter but (a) drops word spaces in tightly set caps ("CHECERCANDO
// VAGIULIVO"), (b) loses the grave accent that comics typeset as a trailing
// backtick ("C'E`", "E` VECCHIO", "POICHE`"). Both are repaired here with a
// word-frequency dictionary, so every translation backend sees real words.
import { IT_WORDS } from './it-words.js';

const RANK = new Map();
IT_WORDS.split(' ').forEach((w, i) => { if (!RANK.has(w)) RANK.set(w, i); });

// Elision stems ("dell'", "nell'"…) are not words on their own.
for (const w of ['dell', 'nell', 'sull', 'dall', 'all', 'quell', 'quest', 'anch', 'dov', 'coll', 'pel', 'giulivo', 'sonetto', 'onor']) if (!RANK.has(w)) RANK.set(w, 300);

// Words whose final vowel always carries an accent. Typeset comics lose it
// (or print it as a backtick), so the bare form is restored.
const ACCENTED = {
  perche: 'perché', poiche: 'poiché', finche: 'finché', benche: 'benché', affinche: 'affinché',
  anziche: 'anziché', giacche: 'giacché', cosi: 'così', piu: 'più', gia: 'già', puo: 'può',
  giu: 'giù', pero: 'però', cio: 'ciò', citta: 'città', eta: 'età', verita: 'verità',
  liberta: 'libertà', felicita: 'felicità', universita: 'università', caffe: 'caffè',
  qualita: 'qualità', quantita: 'quantità', novita: 'novità', attivita: 'attività',
  volonta: 'volontà', facolta: 'facoltà', cosiddetto: 'cosiddetto', lunedi: 'lunedì',
  martedi: 'martedì', mercoledi: 'mercoledì', giovedi: 'giovedì', venerdi: 'venerdì',
};
// After a sentence start, "E" before one of these is the verb "è" ("È vecchio!").
const E_PREDICATE = new Set(['vecchio', 'vecchia', 'vero', 'falso', 'tardi', 'tutto', 'finito', 'finita',
  'stato', 'possibile', 'impossibile', 'inutile', 'bello', 'bella', 'brutto', 'brutta', 'buono', 'buona',
  'giusto', 'sbagliato', 'qui', 'lui', 'lei', 'troppo', 'colpa', 'meglio', 'peggio', 'ridicolo',
  'incredibile', 'strano', 'facile', 'difficile', 'pronto', 'pronta', 'grande', 'piccolo', 'vivo', 'morto']);
const FUNC = new Set(['a', 'e', 'i', 'o', 'di', 'da', 'in', 'un', 'il', 'la', 'lo', 'le', 'li', 'si', 'ci', 'ne', 'ma',
  'se', 'no', 'mi', 'ti', 'vi', 'va', 'ha', 'ho', 'su', 'al', 'è', 'ed', 'ad', 'ai', 'ah', 'oh', 'eh', 'se', 'sì']);


// Words by length, for the one-substitution repair below.
const BY_LEN = new Map();
for (const [w, r] of RANK) { if (r < 3000 && w.length >= 5) { if (!BY_LEN.has(w.length)) BY_LEN.set(w.length, []); BY_LEN.get(w.length).push(w); } }

// All-caps token with exactly one dictionary word one letter away ("NLOVA" ->
// "NUOVA"). Only when unambiguous; anything else is left as read.
function repairOneLetter(lower) {
  const cands = BY_LEN.get(lower.length);
  if (!cands) return null;
  let hit = null;
  for (const w of cands) {
    let d = 0;
    for (let i = 0; i < w.length && d < 2; i++) if (w[i] !== lower[i]) d++;
    if (d === 1) { if (hit) return null; hit = w; }
  }
  return hit;
}

const cost = (w) => 1.5 + Math.log(RANK.get(w) + 20);
const ONE_LETTER = new Set(['a', 'e', 'i', 'o']);

// Best split of `s` (lower-case letters) into dictionary words, allowing one
// unknown stretch of >= 4 letters (rare names, "giulivo"). Returns segment
// lengths or null.
function segment(s) {
  const n = s.length;
  // dp[i][u]: best cost covering s[0..i) with u unknown stretches used.
  const INF = 1e9;
  const dp = Array.from({ length: n + 1 }, () => [INF, INF]);
  const back = Array.from({ length: n + 1 }, () => [null, null]);
  dp[0][0] = 0;
  for (let i = 0; i < n; i++) {
    for (let u = 0; u < 2; u++) {
      if (dp[i][u] >= INF) continue;
      for (let j = i + 1; j <= Math.min(n, i + 20); j++) {
        const w = s.slice(i, j);
        if (RANK.has(w) && (j - i > 1 || ONE_LETTER.has(w))) {
          const c = dp[i][u] + cost(w) + (j - i === 1 ? 3 : 0) + (j - i === 2 ? 1 : 0);
          if (c < dp[j][u]) { dp[j][u] = c; back[j][u] = [i, u, false]; }
        }
        if (u === 0 && j - i >= 4) {
          const c = dp[i][0] + 6 + 2.4 * (j - i);
          if (c < dp[j][1]) { dp[j][1] = c; back[j][1] = [i, 0, true]; }
        }
      }
    }
  }
  let u = dp[n][0] <= dp[n][1] ? 0 : 1;
  if (dp[n][u] >= INF) return null;
  const segs = [];
  let i = n, unknownLen = 0;
  while (i > 0) {
    const [pi, pu, unk] = back[i][u];
    segs.unshift(i - pi);
    if (unk) unknownLen = i - pi;
    i = pi; u = pu;
  }
  if (segs.length < 2) return null;
  if (unknownLen > n * 0.5) return null;
  if (segs.filter(l => l <= 2).length > 2) return null;
  // A short piece must be a real function word ("so"+"netto" for "sonetto" is
  // a missing dictionary entry, not a missed space).
  let p = 0;
  for (const l of segs) { if (l <= 2 && !FUNC.has(s.slice(p, p + l))) return null; p += l; }
  return segs;
}

function applyCase(orig, segs) {
  const out = [];
  let p = 0;
  for (const l of segs) { out.push(orig.slice(p, p + l)); p += l; }
  return out;
}

function fixAccentMarks(core) {
  // Typeset grave accent read as (or dropped for) a trailing backtick/acute.
  return core.replace(/[’‘´]/g, "'").replace(/([AEIOUaeiou])[`´](?!\p{L})/gu, (m, v) => ({ a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù', A: 'À', E: 'È', I: 'Ì', O: 'Ò', U: 'Ù' }[v]))
    .replace(/`/g, '');
}

function restoreCase(word, like) {
  return like === like.toUpperCase() && /\p{L}/u.test(like) ? word.toUpperCase() : (like[0] === like[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word);
}

function fixToken(token) {
  const m = token.match(/^([^\p{L}`´'’]*)([\s\S]*?)([^\p{L}`´'’]*)$/u);
  if (!m || !m[2]) return [token];
  const [, lead, coreRaw, trail] = m;
  const hadMark = /[`´]/.test(coreRaw);
  const bare = coreRaw.replace(/[`´’']/g, '').toLowerCase();
  // Accent-always words, with or without the dropped mark.
  if (ACCENTED[bare] && !coreRaw.includes("'")) return [lead + restoreCase(ACCENTED[bare], coreRaw.replace(/[`´]/g, '')) + trail];
  if (/^c['’]e[`´]?$/i.test(coreRaw)) return [lead + coreRaw.slice(0, 2) + (coreRaw[0] === 'C' ? 'È' : 'è') + trail];
  let core = fixAccentMarks(coreRaw);
  // Italian has no J/K/W/X/Y: a long word ending in one has a stray mark
  // (comma, quote, bubble edge) read as a letter ("VAGIULIVOJ").
  if (core.length >= 6 && /[JKWXYjkwxy]$/.test(core) && !RANK.has(core.toLowerCase())) core = core.slice(0, -1);
  const parts = core.split(/(?<=')/);
  const out = [];
  let prevElision = '';
  parts.forEach((part, pi) => {
    if (part.endsWith("'")) {
      const base = part.slice(0, -1), bl = base.toLowerCase();
      // "POICHE'CHI": the accent was read as an apostrophe.
      if (ACCENTED[bl]) { out.push(restoreCase(ACCENTED[bl], base)); prevElision = ''; return; }
      // "ONORDELL'" / "ILPELNELL'": glued words in front of an elision.
      if (bl.length >= 6 && /^[a-zàèéìòóù]+$/.test(bl) && !RANK.has(bl)) {
        const segs = segment(bl);
        if (segs) {
          const ps = applyCase(base, segs);
          ps.slice(0, -1).forEach(x => out.push(x));
          out.push(ps[ps.length - 1] + "'");
          prevElision = ''; return;
        }
      }
      out.push(part); prevElision = bl + "'"; return;
    }
    const lower = part.toLowerCase();
    let pieces = [part];
    // "C'E" + word -> "C'È" + word ("C'ECHI" is c'è chi, not "echi").
    if (prevElision === "c'" && /^e./i.test(part) && lower.length > 1) {
      const rest = lower.slice(1);
      const segs = RANK.has(rest) ? [1, rest.length] : segment(rest);
      if (segs) {
        const restSegs = RANK.has(rest) ? [rest.length] : segs;
        out.push('È');
        applyCase(part.slice(1), restSegs).forEach(x => out.push(x));
        prevElision = '';
        return;
      }
    }
    prevElision = '';
    if (!/^[a-zàèéìòóù]+$/.test(lower) || RANK.has(lower) || lower.length < 3) { out.push(part); return; }
    if (part === part.toUpperCase() && lower.length >= 5 && !segment(lower)) {
      const fixed = repairOneLetter(lower);
      if (fixed) { out.push(fixed.toUpperCase()); return; }
    }
    const segs = segment(lower);
    // Short unknown tokens ("ELA") are only split when every piece is a real
    // word; longer ones may also keep one unknown stretch ("va" + "giulivo").
    if (segs && (lower.length >= 6 || segs.every((l, k) => RANK.has(lower.slice(segs.slice(0, k).reduce((a, b) => a + b, 0), segs.slice(0, k + 1).reduce((a, b) => a + b, 0)))))) pieces = applyCase(part, segs);
    pieces.forEach(x => out.push(x));
  });
  // Re-glue elisions to the word that follows ("C'" + "È" -> "C'È").
  const words = [];
  let carry = '';
  for (const x of out) {
    if (x.endsWith("'")) { carry += x; continue; }
    words.push(carry + x); carry = '';
  }
  if (carry) words.push(carry);
  if (words.length) { words[0] = lead + words[0]; words[words.length - 1] += trail; }
  void hadMark;
  return words;
}

// OCR sometimes puts accents the language doesn't have on capitals (Á, Ã, Ö…).
// Keep the Italian set (à è é ì ò ó ù) and reduce everything else to the base.
function stripForeignMarks(line) {
  return line.normalize('NFD').replace(/(\p{L})([\u0300-\u036f]+)/gu, (m, b, marks) => {
    const keep = (marks === '\u0300' && 'aeiouAEIOU'.includes(b)) || (marks === '\u0301' && 'eoEO'.includes(b));
    return keep ? m : b;
  }).normalize('NFC');
}

export function fixItalianLine(line) {
  if (!line || !line.trim()) return line;
  line = stripForeignMarks(line).replace(/(\p{L}[,;:!?])(?=\p{L})/gu, '$1 ');
  let toks = line.trim().split(/\s+/);
  // Mostly-capitals lines: "NuOVA" is a misread capital, not a name.
  const letters = line.match(/\p{L}/gu) || [];
  if (letters.length && letters.filter(c => c !== c.toLowerCase()).length / letters.length > 0.6) {
    toks = toks.map(t => /\p{Ll}/u.test(t) && /\p{Lu}.*\p{Lu}/u.test(t) && !/^\p{Lu}\p{Ll}+$/u.test(t) ? t.toUpperCase() : t);
  }
  const out = [];
  for (const t of toks) out.push(...fixToken(t));
  return out.join(' ');
}

// Captions open with a drop cap: a big "M" and a small-caps "a" that OCR reads
// as two one-letter lines ("M" / "A" / "ANCORA UNA VOLTA…"). Left alone, the
// lone consonant is stripped as artwork debris and the "A" becomes the
// preposition. Re-join them when the pair spells a two-letter function word.
const DROPCAP_WORDS = new Set(['ma', 'se', 'ne', 'ci', 'si', 'mi', 'ti', 'vi', 'li', 'la', 'lo', 'le', 'di', 'da', 'no', 'su']);
function joinDropCap(text) {
  const m = text.match(/^\s*([B-DF-HJ-NP-TV-Zb-df-hj-np-tv-z])[\s\n]+([AEIOUaeiou])(?=[\s\n]|$)/);
  if (!m || !DROPCAP_WORDS.has((m[1] + m[2]).toLowerCase())) return text;
  return m[1] + m[2] + text.slice(m[0].length);
}

// Block-level: line fixes plus the "È" sentence-start rule.
export function fixItalianText(text) {
  if (!text) return text;
  text = joinDropCap(text);
  const lines = text.split('\n').map(fixItalianLine);
  let t = lines.join('\n');
  // Artwork next to a caption leaves stray capital consonants at its ends
  // ("... NUOVA J", "C ...") — Italian has no one-consonant words.
  if (t.split(/\s+/).length >= 3) {
    t = t.split('\n').map(l => l.split(/\s+/).filter(w => !/^[B-DF-HJ-NP-TV-Z]$/.test(w)).join(' ')).join('\n');
  }
  const words = t.split(/\s+/).length;
  if (words <= 6) {
    // Short exclamation: a lone "E" opening a sentence before a predicate is "È".
    t = t.replace(/(^|[!?.]\s+)E(\s+)(\p{L}+)/gu, (m0, pre, sp, w) => E_PREDICATE.has(w.toLowerCase()) ? `${pre}È${sp}${w}` : m0);
  }
  return t;
}

// Brand/logo lettering that must stay as printed (not translated, not erased).
// The logo is often boxed in two pieces, so "WALT" alone counts too.
const BRAND_RE = /disney|d[il1]sn[e3]|^walt[a-z]?$/;
export function isBrandText(text) {
  return BRAND_RE.test((text || '').toLowerCase().replace(/[^\p{L}]/gu, ''));
}

// Share of >= 3-letter tokens that are dictionary words (0..1), -1 if fewer
// than 3 such tokens. Low values mean the OCR read artwork or unreadable
// lettering — better left alone than translated into confident nonsense.
export function italianWordRatio(text) {
  const toks = (text || '').toLowerCase().split(/[^\p{L}]+/u).filter(t => t.length >= 3);
  if (toks.length < 3) return -1;
  return toks.filter(t => RANK.has(t)).length / toks.length;
}

// A token mixing letters and digits ("DELL7TT0I") is never Italian: it is
// decorative lettering or artwork the recogniser forced into characters.
export function hasMixedAlnumToken(text) {
  return (text || '').split(/\s+/).some(t => { const core = t.replace(/[^\p{L}\p{N}]/gu, ''); return /\p{L}/u.test(core) && /\p{N}/u.test(core) && core.length >= 4; });
}

// Whether OCR text should be left as printed (not translated, not erased):
// logos, unreadable lettering, and — for free-standing text (titles, sound
// effects) where nothing but dictionary quality vouches for the reading —
// a low share of real words.
export function shouldSkipItalianBlock(text, textClass) {
  if (!text) return false;
  if (isBrandText(text) || hasMixedAlnumToken(text)) return true;
  const ratio = italianWordRatio(text);
  if (ratio === -1) return false;
  return ratio < (textClass === 'text_free' ? 0.6 : 0.34);
}
