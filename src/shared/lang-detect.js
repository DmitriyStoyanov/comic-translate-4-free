// Script-based source-language detection for the 'auto' source setting.
//
// Baberu reads Japanese, English, and both Chineses with a single model, so
// detection runs on the OCR'd text — no extra model or download. Heuristics:
//   hiragana/katakana present -> Japanese (kana never appears in Chinese)
//   hangul present -> Korean (unsupported: treated as undetectable)
//   CJK ideographs -> Chinese; Simplified vs Traditional by a vote over
//     common distinctive characters (国/國, 语/語, …). Short texts with no
//     distinctive chars are genuinely ambiguous -> null.
//   Latin letters -> English, unless Italian markers are present (a strong
//     diacritic or a common function word). Short/ambiguous Latin text stays
//     'en' — Italian and English share the alphabet. Other Latin languages
//     (Spanish, French…) are still reported as 'en'; pin them manually.
// detectPageLang takes a majority vote across blocks; ties -> null (the
// caller falls back to Japanese, the old default).

const KANA_RE = /[぀-ヿㇰ-ㇿ]/;
const HANGUL_RE = /[가-힯]/;
const CJK_RE = /[一-鿿]/;
const LATIN_RE = /[A-Za-z]/;

// Whole-word Italian markers: function words that English doesn't use, plus
// è/ò/ù/così/più (French shares è/à, Spanish é/á — the word list decides).
// /u so accented letters count as word characters at \b boundaries.
const IT_RE = /\b(che|è|per|con|non|la|il|lo|le|di|un|una|sono|ho|hai|mio|tua|così|più|questo|quello|nostro|vostro|anche|molto|bene|allora)\b/iu;

// Common characters that only exist in one variant. Kept short on purpose —
// this is a vote, not a dictionary; manga dialogue is full of these.
// NOTE: characters that are also standard Japanese shinjitai (国 学 会 …)
// are deliberately excluded — a kanji-only Japanese bubble with no kana
// would otherwise misdetect as zh-CN. Ambiguous -> null -> Japanese fallback.
const SIMP_ONLY = '语们汉发对时实让认识这进远运门问间现义为龙龟凤华专业东丝买乱争云产亲计议热爱车丽书卖头坏环还获机鸡积极际继价艰舰阶节洁结紧锦惊镜纠举剧据卷开颗夸块怀汇伙划娇骄搅轿较秸仅谨么亿从达带单导敌递淀电动斗独读吨夺儿叶忆异阴饮隐应营赢拥优忧邮犹游诱于逾鱼渔娱屿语郁吁愈欲狱预驭鸳渊辕园员圆缘愿约跃钥岳粤悦阅郧匀陨蕴酝晕韵杂灾载攒暂赞赃凿枣责择则泽贼赠扎轧闸栅诈斋债毡粘盏斩辗崭栈占战绽张涨帐账胀赵蛰辙锗贞针侦诊镇阵挣睁征狰帧郑证织职执只纸志掷致帜制质钟终种肿众轴皱骤猪诸诛烛瞩嘱贮驻砖转赚桩庄装妆壮状锥赘坠缀谆准浊兹咨资渍踪骤综总纵邹诅组钻说话听讲讨论译记';
const TRAD_ONLY = '國學們漢發對實讓這義為龍龜鳳華萬與專業東絲買亂爭雲產點麗賣壞環還會獲雞積極繼價艱艦階潔結緊錦盡驚鏡糾舊舉劇據捲顆誇塊懷匯夥劃嬌驕攪轎較稭藉僅謹麼億從達帶單當黨燈敵遞澱電鬥獨讀噸奪墮兒葉憶異陰隱應營贏擁憂郵猶誘於餘踰魚漁娛嶼鬱籲癒慾獄譽預馭鴛淵轅園圓緣願約躍鑰嶽粵悅閱鄖勻隕蘊醞暈韻雜災攢贊贓鑿棗責擇則澤賊贈紮軋閘柵詐齋債氈黏盞輾嶄棧佔戰綻張漲帳賬脹趙蟄轍鍺貞針偵診陣掙睜徵猙幀鄭證織隻誌擲緻幟製滯鐘終腫眾軸皺晝驟豬誅燭矚囑貯駐磚轉賺樁莊裝妝壯狀錐贅墜綴諄準濁茲諮資漬蹤驟綜總縱鄒詛鑽說話聽講討論譯';

// One block of OCR text -> 'ja' | 'en' | 'it' | 'zh-CN' | 'zh-TW' | null.
export function detectBlockLang(text) {
  if (!text || !text.trim()) return null;
  if (KANA_RE.test(text)) return 'ja';
  if (HANGUL_RE.test(text)) return null; // Korean: no OCR support, undetectable
  if (CJK_RE.test(text)) {
    let s = 0, t = 0;
    for (const ch of text) {
      if (SIMP_ONLY.includes(ch)) s++;
      else if (TRAD_ONLY.includes(ch)) t++;
    }
    // No distinctive chars: genuinely ambiguous (could be kanji-only
    // Japanese) — let the caller fall back.
    if (!s && !t) return null;
    return s >= t ? 'zh-CN' : 'zh-TW';
  }
  if (LATIN_RE.test(text)) return IT_RE.test(text) ? 'it' : 'en';
  return null;
}

// Majority vote across a page's blocks. Ties / all-null -> null.
export function detectPageLang(texts) {
  const votes = { ja: 0, en: 0, it: 0, 'zh-CN': 0, 'zh-TW': 0 };
  for (const t of texts || []) {
    const l = detectBlockLang(t);
    if (l) votes[l]++;
  }
  let best = null, bestN = 0, tie = false;
  for (const l of Object.keys(votes)) {
    if (votes[l] > bestN) { best = l; bestN = votes[l]; tie = false; }
    else if (votes[l] === bestN && bestN > 0) tie = true;
  }
  return tie ? null : best;
}
