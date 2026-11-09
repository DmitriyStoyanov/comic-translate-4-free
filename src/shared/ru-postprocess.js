// Russian clean-up of LLM output. Small models translating from Italian keep
// the gender of the source noun ("sorpresa" is feminine, so "la tua sorpresa"
// becomes «твоя сюрприз»). The fix is deterministic for the few nouns whose
// gender differs between the two languages and that comics use constantly.

// Nouns that are masculine in Russian but feminine in Italian (stem -> forms).
const MASC_NOUNS = 'сюрприз\\p{L}*';
// Feminine nominative modifier -> masculine nominative.
const MODIFIERS = {
  моя: 'мой', твоя: 'твой', ваша: 'ваш', наша: 'наш', его: 'его', эта: 'этот', такая: 'такой',
  большая: 'большой', маленькая: 'маленький', приятная: 'приятный', хорошая: 'хороший', новая: 'новый',
  первая: 'первый', последняя: 'последний', настоящая: 'настоящий',
};
const MOD_RE = new RegExp('(^|[^\\p{L}])(' + Object.keys(MODIFIERS).join('|') + ')([.…\\s]{0,4})(' + MASC_NOUNS + ')', 'giu');

function matchCase(word, like) {
  if (like === like.toUpperCase() && like.length > 1) return word.toUpperCase();
  return like[0] === like[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
}

export function fixRussianAgreement(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(MOD_RE, (m0, pre, mod, gap, noun) => {
    // Only the nominative noun ("сюрприз") is certain to need the masculine
    // modifier; "ваша сюрпризом" would be a different mistake we leave alone.
    if (noun.toLowerCase() !== 'сюрприз') return m0;
    return pre + matchCase(MODIFIERS[mod.toLowerCase()], mod) + gap + noun;
  }).replace(/(^|[^\p{L}])(была|была)(\s+не\s+)(сюрприз)(?!\p{L})/giu, (m0, pre, v, mid, noun) => pre + matchCase('был', v) + mid + noun);
}
