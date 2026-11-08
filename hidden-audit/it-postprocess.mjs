// Regression checks for the Italian OCR clean-up. Usage: node hidden-audit/it-postprocess.mjs
import { fixItalianText, isBrandText } from '../src/shared/it-postprocess.js';
const cases = [
  ["C'ECHI CERCA IL PEL NELL'UOVO", "C'È CHI CERCA IL PEL NELL'UOVO"],
  ["MA C'EPURE IL SOTTOSCRITTO", "MA C'È PURE IL SOTTOSCRITTO"],
  ["C'E CHI CERCA", "C'È CHI CERCA"],
  ["UNA RIMA,UN VERSO,UN MOTTO", "UNA RIMA, UN VERSO, UN MOTTO"],
  ["PER COMPORRE UN BEL SONETTO", "PER COMPORRE UN BEL SONETTO"],       // missing-from-dictionary word must not be split
  ["E, POICHE CHI CERCÃ TROVA,", "E, POICHÉ CHI CERCA TROVA,"],
  ['"ÁNNONUOVO,VITA NLOVA!"', '"ANNO NUOVO, VITA NUOVA!"'],
  ["EVECCHIO", "È VECCHIO"],
  ["PFUI! E` VECCHIO!", "PFUI! È VECCHIO!"],
  ["PAPERINO E TOPOLINO", "PAPERINO E TOPOLINO"],                         // names are left alone
  // lines as read from the real balloon at 1.0x-2.0x capture scale
  ["C'ECHI CERCA ILPELNELL'UOVO", "C'È CHI CERCA IL PEL NELL'UOVO"],
  ["IN ONORDELL'ANNONUOVO!L", "IN ONOR DELL'ANNO NUOVO!"],
  ["HOTROVATO QUESTO DETTO:", "HO TROVATO QUESTO DETTO:"],
  ["E, POICHE'CHI CERCA TROVA,", "E, POICHÉ CHI CERCA TROVA,"],
  ["CHE CERCANDO VAGIULIVOJ", "CHE CERCANDO VA GIULIVO"],
  ["Che cosa vuoi? E ora?", "Che cosa vuoi? E ora?"],
];
let bad = 0;
for (const [i, o] of cases) { const g = fixItalianText(i); if (g !== o) { bad++; console.log('FAIL', JSON.stringify(i), '->', JSON.stringify(g), 'expected', JSON.stringify(o)); } }
if (!isBrandText('l(aitdisne') || !isBrandText('l(aitdisney') || !isBrandText('WALT') || !isBrandText('WALT.') || isBrandText('PAPERINO') || isBrandText('WALTER IL GRANDE')) { bad++; console.log('FAIL brand'); }
console.log(bad ? bad + ' failure(s)' : 'all ' + (cases.length + 1) + ' checks passed');
process.exit(bad ? 1 : 0);
