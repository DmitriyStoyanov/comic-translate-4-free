// Usage: node hidden-audit/ru-postprocess.mjs
import { fixRussianAgreement } from '../src/shared/ru-postprocess.js';
const cases = [
  ['Если это... это ваша... сюрприз!', 'Если это... это ваш... сюрприз!'],
  ['ЕСЛИ ЭТО… ТВОЯ СЮРПРИЗ', 'ЕСЛИ ЭТО… ТВОЙ СЮРПРИЗ'],
  ['Это была не сюрприз...', 'Это был не сюрприз...'],
  ['Это не было сюрпризом', 'Это не было сюрпризом'],
  ['Моя неудача', 'Моя неудача'],
];
let bad = 0;
for (const [i, o] of cases) { const g = fixRussianAgreement(i); if (g !== o) { bad++; console.log('FAIL', i, '->', g); } }
console.log(bad ? bad + ' failure(s)' : 'all ' + cases.length + ' checks passed');
process.exit(bad ? 1 : 0);
