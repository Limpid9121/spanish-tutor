// 陰陽性陷阱（第 1.4 批）的純函式：挑題、判斷對錯、組回饋文字、評分存檔。不碰畫面。
// 每個字一張卡，卡片 id 是 `g-xxx:g`（dir "g"）。這些卡只在這個專區用，今日頁不會排（見 session.js 的 buildToday）。
import { cardId, isDue, newRecord, review } from "./srs.js";

export const GENDER_DIR = "g";
export const DRILL_SIZE = 10;

// 這個字前面該接哪個冠詞：陽性 el；陰性 la，但 el-f 組（單數用 el 的陰性字）是 el
export function correctArticle(trap) {
  if (trap.gender === "m") return "el";
  return trap.group === "el-f" ? "el" : "la";
}

// 判斷對錯並組回饋。choice：他按的 "el" 或 "la"。
// 回傳 { correct, answer, headline, notes[] }：答錯時 notes 含該組規則句；el-f 組不論對錯都說明「陰性名詞，單數用 el」。
export function judgeAnswer(trap, choice, groups = []) {
  if (choice !== "el" && choice !== "la") throw new Error(`只能選 el 或 la：${choice}`);
  const answer = correctArticle(trap);
  const correct = choice === answer;
  const notes = [];
  if (trap.group === "el-f") notes.push("陰性名詞，單數用 el。");
  if (!correct) {
    const rule = groups.find((g) => g.id === trap.group)?.rule;
    if (rule) notes.push(rule);
  }
  return {
    correct, answer,
    headline: correct ? "對了" : `不對，正確是 ${answer} ${trap.es}`,
    notes,
  };
}

export function scoreText(correct, total) {
  return `答對 ${correct} ／ ${total} 題`;
}

// 依各組第一次出現的順序，每組輪流取一個
function roundRobin(list) {
  const order = [];
  const buckets = new Map();
  for (const t of list) {
    if (!buckets.has(t.group)) { buckets.set(t.group, []); order.push(t.group); }
    buckets.get(t.group).push(t);
  }
  const out = [];
  while (out.length < list.length) {
    for (const g of order) if (buckets.get(g).length) out.push(buckets.get(g).shift());
  }
  return out;
}

// 一輪的題目：先到期的（到期時間早的先），再來沒練過的（各組輪流、組內依清單順序），最多 n 題，不足就有幾題出幾題。
// early：全部都還沒到期時的「提早練習」，不足 n 題再用最近到期的補。
export function pickDrill({ traps, cards, now = new Date(), n = DRILL_SIZE, early = false }) {
  const rec = (t) => cards.get(cardId(t.id, GENDER_DIR));
  const due = traps.filter((t) => rec(t) && isDue(rec(t), now)).sort((a, b) => rec(a).due - rec(b).due);
  const fresh = roundRobin(traps.filter((t) => !rec(t)));
  const out = [...due, ...fresh];
  if (early) {
    const later = traps.filter((t) => rec(t) && !isDue(rec(t), now)).sort((a, b) => rec(a).due - rec(b).due);
    out.push(...later);
  }
  return out.slice(0, n);
}

// 有沒有「已經練過、但還沒到期」的字可以提早練
export function hasEarly({ traps, cards, now = new Date() }) {
  return traps.some((t) => { const r = cards.get(cardId(t.id, GENDER_DIR)); return r && !isDue(r, now); });
}

// 評分並存檔：答對＝3、答錯＝1（ts-fsrs）。存檔成功才更新 cards；失敗就丟錯，由畫面提示。
// 不呼叫 bumpNew：陰陽性練習不算「今天的新字」，不能吃掉新字額度。
export async function gradeGender({ store, cards, trap, correct, now = new Date() }) {
  const id = cardId(trap.id, GENDER_DIR);
  const rec = review(cards.get(id) ?? newRecord(trap.id, GENDER_DIR, now), correct ? 3 : 1, now);
  await store.saveCard(rec);
  await store.addLog({ id: `${now.getTime()}-${id}`, cardId: id, grade: correct ? 3 : 1, at: now.getTime() });
  cards.set(id, rec);
  return rec;
}
