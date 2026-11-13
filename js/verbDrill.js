// 動詞變化練習（第 2b 批）的純函式：出題、判分、字母對齊、排程。不碰畫面和資料庫。
// 出題、判分、正解顯示只用 verbs.json 的 pres（現在式 6 格）與 ger（現在分詞）。
// 資料裡還有一個基準形欄位，那是拿來算變化表底線位置的，多半不是真的字，這裡絕對不能碰。
import { dayKey, isDue } from "./srs.js";
import { foldAccents, splitZh } from "./words.js";
import { norm } from "./practice.js";
import { PERSON_LABELS, REFLEXIVE_PRONOUNS, VOSOTROS } from "./verbs.js";

export const VERB_DIR = "v";
export const TENSES = ["pres", "ger"]; // 現在式、現在分詞（過去式等以後再加）
export const TENSE_LABEL = { pres: "現在式", ger: "現在分詞" };
export const DEFAULT_NEW_VERBS = 3;

export function verbCardId(verbId, tense) {
  return `${verbId}:${tense}`;
}

// 每天新動詞數另存在 meta 的 new:v-日期（備份會一起收）
export function verbDayKey(now = new Date()) {
  return `v-${dayKey(now)}`;
}

export function verbCards(cards) {
  return [...cards.values()].filter((r) => r.dir === VERB_DIR);
}

// 依 syllabus 單元順序（u03、u04…），同一單元保持檔案裡的順序
export function orderVerbs(verbs) {
  const n = (v) => Number.parseInt(String(v.unit ?? "").replace(/\D/g, ""), 10) || 0;
  return verbs.map((v, i) => [v, i]).sort((a, b) => n(a[0]) - n(b[0]) || a[1] - b[1]).map(([v]) => v);
}

function tenseOf(rec) {
  return rec.tense ?? String(rec.id).split(":")[1];
}

// 今天的動詞練習：到期的動詞卡 ＋ 新動詞（每個新動詞兩張新卡：現在式、分詞）。
// 新動詞數 = newVerbsPerDay − 今天已經開始學的；已經有現在式卡、還沒有分詞卡的，補一張分詞（不佔額度）。
export function buildVerbToday({ verbs, cards, settings = {}, now = new Date(), introducedToday = 0 }) {
  const byId = new Map(verbs.map((v) => [v.id, v]));
  const due = verbCards(cards)
    .filter((r) => byId.has(r.wordId) && isDue(r, now))
    .sort((a, b) => a.due - b.due)
    .map((r) => ({ id: r.id, wordId: r.wordId, dir: VERB_DIR, tense: tenseOf(r), isNew: false }));
  const item = (v, tense) => ({ id: verbCardId(v.id, tense), wordId: v.id, dir: VERB_DIR, tense, isNew: true });
  let room = Math.max(0, (settings.newVerbsPerDay ?? DEFAULT_NEW_VERBS) - introducedToday);
  const fresh = [];
  for (const v of orderVerbs(verbs)) {
    const hasPres = cards.has(verbCardId(v.id, "pres"));
    const hasGer = cards.has(verbCardId(v.id, "ger"));
    if (!hasPres) {
      if (room <= 0) continue;
      room--;
      fresh.push(item(v, "pres"));
      if (!hasGer) fresh.push(item(v, "ger"));
    } else if (!hasGer) {
      fresh.push(item(v, "ger"));
    }
  }
  return { due, fresh, queue: [...due, ...fresh] };
}

// 今日頁「動詞：到期 N 張」
export function verbDueCount(cards, verbs, now = new Date()) {
  const ids = new Set(verbs.map((v) => v.id));
  return verbCards(cards).filter((r) => ids.has(r.wordId) && isDue(r, now)).length;
}

// 能出的人稱（第幾格）：預設不含 vosotros
// 各人稱可以帶在前面的主詞
const SUBJECTS = [["yo"], ["tú"], ["él", "ella", "usted"], ["nosotros", "nosotras"], ["vosotros", "vosotras"], ["ellos", "ellas", "ustedes"]];

export function personPool(vosotros = false) {
  return [0, 1, 2, 3, 4, 5].filter((i) => vosotros || i !== VOSOTROS);
}

// 出一題。現在式：隨機一個人稱；分詞：沒有人稱。rng 只在現在式用一次。
export function makeQuestion(verb, tense, rng = Math.random, { vosotros = false } = {}) {
  const promptZh = splitZh(verb.zh ?? "").main;
  if (tense === "ger") {
    const hint = verb.reflexive ? "只寫分詞，不加代名詞" : ""; // acostándose 這種連寫形不算這題的答案（2b 審核 B1）
    return { verbId: verb.id, tense, person: null, label: TENSE_LABEL.ger, promptEs: verb.inf, promptZh, hint };
  }
  const pool = personPool(vosotros);
  const person = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return { verbId: verb.id, tense: "pres", person, label: TENSE_LABEL.pres, promptEs: `${PERSON_LABELS[person]} ＋ ${verb.inf}`, promptZh };
}

// 正解（變化形本身）
export function expectedForm(verb, q) {
  return q.tense === "ger" ? verb.ger : verb.pres[q.person];
}

// 顯示給他看的正解：反身動詞的現在式帶代名詞（me llamo）
export function expectedDisplay(verb, q) {
  const form = expectedForm(verb, q);
  return verb.reflexive && q.tense === "pres" ? `${REFLEXIVE_PRONOUNS[q.person]} ${form}` : form;
}

// 字母對齊：把他打的和正解逐字母對齊（最少改動），回傳一排欄位 { t: 他打的字母或 null, e: 正解的字母或 null, ok }。
// t 為 null＝他漏打；e 為 null＝他多打；兩邊都有但不同＝打錯（含只差重音）。大小寫不算錯。
export function alignLetters(typed, expected) {
  const a = [...String(typed ?? "").normalize("NFC")];
  const b = [...String(expected ?? "").normalize("NFC")];
  const same = (x, y) => x.toLowerCase() === y.toLowerCase();
  const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (same(a[i - 1], b[j - 1]) ? 0 : 1));
    }
  }
  const cols = [];
  let i = a.length, j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (same(a[i - 1], b[j - 1]) ? 0 : 1)) {
      cols.push({ t: a[i - 1], e: b[j - 1], ok: same(a[i - 1], b[j - 1]) });
      i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      cols.push({ t: a[i - 1], e: null, ok: false });
      i--;
    } else {
      cols.push({ t: null, e: b[j - 1], ok: false });
      j--;
    }
  }
  return cols.reverse();
}

// 判分：exact（全對）、accent（只差重音）、wrong。反身動詞的現在式，打不打代名詞都行（代名詞要對）。
// 回傳 { result, expected（變化形）, expectedDisplay, typed（他打的原樣）, typedForm（去掉代名詞、整理過的）, align }
export function gradeVerbAnswer(input, verb, q) {
  const expected = expectedForm(verb, q);
  let typedForm = norm(input);
  if (q.tense === "pres") { // 主詞可打可不打（yo hablo、hablo 都對）；打了別的人稱的主詞就不拿掉，照樣判錯（主對話 2b 決定）
    const subj = SUBJECTS[q.person].find((s) => foldAccents(typedForm).startsWith(foldAccents(s) + " "));
    if (subj) typedForm = typedForm.slice(subj.length).trim();
  }
  let alignTyped = null; // 打了錯的代名詞時，用完整的「代名詞＋動詞」對齊，才標得出真正錯的字母（2b 審核 B2）
  if (verb.reflexive && q.tense === "pres") {
    const pron = `${REFLEXIVE_PRONOUNS[q.person]} `;
    if (typedForm.startsWith(pron)) typedForm = typedForm.slice(pron.length).trim();
    else if (/^(me|te|se|nos|os) /.test(typedForm)) alignTyped = typedForm;
  }
  const want = norm(expected);
  let result = "wrong";
  if (typedForm && typedForm === want) result = "exact";
  else if (typedForm && foldAccents(typedForm) === foldAccents(want)) result = "accent";
  return {
    result, expected, expectedDisplay: expectedDisplay(verb, q),
    typed: String(input ?? "").trim(), typedForm,
    align: alignTyped ? alignLetters(alignTyped, expectedDisplay(verb, q)) : alignLetters(typedForm, expected),
  };
}
