// 文法單元（第 3a 批）的純函式：題目組句、判分、打亂、單元狀態、學完建卡、今日到期題。不碰畫面和資料庫。
// 卡片：id `${題目id}:u`、wordId 是題目 id、dir "u"、另外帶 unit（例如 "u05"）。
import { cardId, isDue, newRecord, review } from "./srs.js";
import { foldAccents } from "./words.js";
import { norm } from "./practice.js";

export const GRAMMAR_DIR = "u";

export function grammarCardId(drillId) {
  return cardId(drillId, GRAMMAR_DIR);
}

// 文法題卡（只收 dir "u"）
export function grammarCards(cards) {
  return [...cards.values()].filter((r) => r.dir === GRAMMAR_DIR);
}

// 題目的完整句子：choice／fill 把答案填回空格，order 用空格接 tokens
export function fillSentence(drill) {
  if (drill.type === "order") return drill.tokens.join(" ");
  const a = Array.isArray(drill.answer) ? drill.answer[0] : drill.answer;
  return drill.es.replace("___", a);
}

export function gradeChoice(drill, picked) {
  return picked === drill.answer ? "correct" : "incorrect";
}

// 打字：完全一樣（不分大小寫、不看句首 ¿¡ 與句尾標點）exact；只差重音 accent；其他 wrong（空白也是 wrong）
export function gradeFill(drill, input) {
  const answers = Array.isArray(drill.answer) ? drill.answer : [drill.answer];
  const expected = answers[0];
  const typed = norm(input);
  if (!typed) return { result: "wrong", expected, typed: "" };
  if (answers.some((a) => norm(a) === typed)) return { result: "exact", expected, typed };
  if (answers.some((a) => foldAccents(norm(a)) === foldAccents(typed))) return { result: "accent", expected, typed };
  return { result: "wrong", expected, typed };
}

// 排字：picked 是他點的 token 順序；跟 tokens 或任一 alt 完全相同才 correct（大小寫、標點照原樣）
export function gradeOrder(drill, picked) {
  const same = (a, b) => a.length === b.length && a.every((t, i) => t === b[i]);
  const ok = same(picked, drill.tokens) || (drill.alt ?? []).some((alt) => same(picked, alt));
  return ok ? "correct" : "incorrect";
}

// 打亂 tokens，但不能剛好跟正確順序一樣（全部相同的除外）
export function shuffleTokens(tokens, rng = Math.random) {
  const a = [...tokens];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const same = a.every((t, i) => t === tokens[i]);
  if (same && new Set(tokens).size > 1) a.push(a.shift()); // 轉一格：只要不是全部相同，轉一格一定不一樣
  return a;
}

// 2 個選項不打亂（hay／está 固定順序比較好認），3 個以上才打亂
export function shuffleOptions(options, rng = Math.random) {
  const a = [...options];
  if (a.length <= 2) return a;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 單元狀態：later（還沒做好）、skipped（我會了）、done（每一題都有卡）、started（一部分有卡）、new
// unit：units.json 那一列，加上 drills（單元檔的題目）
export function unitStatus(unit, cards, settings = {}) {
  if (unit.ready === false) return "later";
  if (settings.unitSkip?.[unit.id] === true) return "skipped";
  const ids = (unit.drills ?? []).map((d) => d.id);
  const have = ids.filter((id) => cards.has(grammarCardId(id))).length;
  if (ids.length > 0 && have === ids.length) return "done";
  if (have > 0) return "started";
  return "new";
}

export const FIRST_GRADE = { correct: 3, exact: 3, accent: 2, wrong: 1, incorrect: 1 };

// 第一次學完一個單元：每題建一張卡（第一次作答就對＝3、只差重音＝2、錯＝1）。
// results：{ 題目id: 第一次作答的結果 }（Map 也可以）。排程交給 srs.js 的 review，不自己算。
// cards 有給時，已經有卡的題目不重建。回傳新卡紀錄的陣列。
export function finishLearning(unitData, results, now = new Date(), cards = null) {
  const get = (id) => (results instanceof Map ? results.get(id) : results?.[id]);
  const out = [];
  for (const d of unitData.drills) {
    if (cards?.has(grammarCardId(d.id))) continue;
    const grade = FIRST_GRADE[get(d.id)] ?? 1; // 沒有作答紀錄視為忘了
    const base = { ...newRecord(d.id, GRAMMAR_DIR, now), unit: unitData.id };
    out.push(review(base, grade, now));
  }
  return out;
}

function unitOf(rec) {
  return rec.unit ?? String(rec.wordId).split("-")[0];
}

// 今日的文法複習：到期的 dir "u" 卡，依 due 排序。
// 跳過的單元（我會了）、還沒 ready 的單元、資料裡已經沒有的題目都不出。沒有新卡額度：新題目只從「學單元」進來。
// units：units.json；unitData：{ 單元id: 單元檔 }
export function buildGrammarToday({ units, unitData, cards, settings = {}, now = new Date() }) {
  const ready = new Set((units ?? []).filter((u) => u.ready !== false).map((u) => u.id));
  const drillIds = new Map();
  for (const [uid, data] of Object.entries(unitData ?? {})) drillIds.set(uid, new Set((data?.drills ?? []).map((d) => d.id)));
  const due = grammarCards(cards)
    .filter((r) => {
      const uid = unitOf(r);
      return ready.has(uid) && settings.unitSkip?.[uid] !== true && drillIds.get(uid)?.has(r.wordId) && isDue(r, now);
    })
    .sort((a, b) => a.due - b.due)
    .map((r) => ({ id: r.id, wordId: r.wordId, dir: GRAMMAR_DIR, unit: unitOf(r), isNew: false }));
  return { due, fresh: [], queue: [...due] };
}

export function grammarDueCount(args) {
  return buildGrammarToday(args).due.length;
}
