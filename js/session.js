// 今日要複習什麼：純函式，不碰畫面和資料庫，方便測試。
import { cardId, dayKey, isDue, newRecord, newVerbRecord, review, shouldRequeue } from "./srs.js";

export const DEFAULT_SETTINGS = {
  newPerDay: 10, reverse: false, fontSize: "m",
  sources: { textbook: true, spoken: true, news: true, social: true },
  answerMode: { r: "type", f: "choice" }, // 作答方式（第 1.3 批）：看中文的卡 type 打字／flip 翻面；看西文的卡 choice 選擇題／flip 翻面
  newVerbsPerDay: 3, verbVosotros: false, // 動詞變化練習（第 2b 批）：每天新動詞幾個、練習要不要出 vosotros
  unitSkip: {}, // 文法單元（第 3a 批）：他按了「我會了」的單元 { 單元id: true }，跟備份走
  familiarOverride: {}, // 他自己改的「已熟悉」：{ 字id: true（已熟悉，不進新字）／false（加回學習） }，蓋過內容裡的預設 familiar
};

// 新字來源（設定頁的四個開關，順序固定）：課本、口語、新聞、社群。縮寫小詞包（layer: abbr）算社群。
export const SOURCES = ["textbook", "spoken", "news", "social"];
export const INSERT_EVERY = 8; // 每 8 個新字穿插 1 個口語、新聞或社群：第 8、16、24… 個

// 單字卡（不含陰陽性陷阱專區的 dir "g" 卡）。今日頁、篩字、「是不是第一次使用」都只看這些。
export function wordCards(cards) {
  return [...cards.values()].filter((r) => r.dir === "f" || r.dir === "r"); // 只收單字卡（1.4 審核 B2：之後還有動詞卡 v）
}

export function sourceOf(word) {
  const layer = word.layer ?? "textbook";
  return layer === "abbr" ? "social" : layer;
}

// 這個字的來源開關是不是開著（缺的視為開）。正向新卡（orderNew）與反向新卡（buildToday）共用這一個判斷（第 2a.1 批）。
export function sourceEnabled(word, sources = DEFAULT_SETTINGS.sources) {
  return sources?.[sourceOf(word)] !== false;
}

// 這個字算不算「已熟悉」：他自己改過的優先，沒改過就看內容裡的預設 familiar（第 1.1b 批決定 2）
export function isFamiliar(word, override = {}) {
  const o = override?.[word.id];
  return typeof o === "boolean" ? o : word.familiar === true;
}

// 新字出現順序（固定，不隨機）：課本字依檔案順序；每 7 個課本字後面穿插 1 個口語／新聞／社群，
// 穿插字三條道輪流取（口語、新聞、社群、口語…），社群道裡「社群字」與「縮寫」交錯。
// 課本字用完就把剩下的穿插字接在後面，穿插字用完就繼續課本字。
// sources：四個開關，缺的視為開。familiarOverride：他自己改的已熟悉。已熟悉的字不進佇列。
export function orderNew(vocab, sources = DEFAULT_SETTINGS.sources, familiarOverride = {}) {
  const on = (w) => sourceEnabled(w, sources) && !isFamiliar(w, familiarOverride);
  const enabled = vocab.filter(on);
  const textbook = enabled.filter((w) => sourceOf(w) === "textbook");
  const pick = (l) => enabled.filter((w) => (w.layer ?? "") === l);
  const social = pick("social"), abbr = pick("abbr");
  const socialLane = [];
  for (let i = 0; i < Math.max(social.length, abbr.length); i++) { // 社群、縮寫、社群、縮寫…；一邊用完就接另一邊
    if (i < social.length) socialLane.push(social[i]);
    if (i < abbr.length) socialLane.push(abbr[i]);
  }
  const lanes = [pick("spoken"), pick("news"), socialLane];
  let lane = 0;
  const nextExtra = () => {
    for (let i = 0; i < lanes.length; i++) {
      const k = (lane + i) % lanes.length;
      if (lanes[k].length) { lane = (k + 1) % lanes.length; return lanes[k].shift(); }
    }
    return null;
  };
  const out = [];
  let t = 0;
  while (t < textbook.length) {
    out.push(textbook[t++]);
    if (t % (INSERT_EVERY - 1) === 0) {
      const x = nextExtra();
      if (x) out.push(x);
    }
  }
  for (let x = nextExtra(); x; x = nextExtra()) out.push(x);
  return out;
}

// vocab：單字陣列（檔案順序）；cards：Map(cardId → 紀錄)
// introducedToday：今天已經開始學的新卡數
export function buildToday({ vocab, cards, settings, now = new Date(), introducedToday = 0 }) {
  const byId = new Map(vocab.map((w) => [w.id, w]));
  const due = wordCards(cards) // dir "g"（陰陽性陷阱專區）的卡不進今日，reverse 開著也一樣
    .filter((r) => !byId.has(r.wordId) ? false : !isFamiliar(byId.get(r.wordId), settings.familiarOverride)) // 已熟悉的字，到期卡也停；切回學習就恢復（第 1.1c 批決定 2）。另外：// 詞表裡已經沒有的字（舊備份、拿掉的字）不排進來，不然複習畫面會當掉（審核 B5）
    .filter((r) => (settings.reverse || r.dir === "f") && isDue(r, now))
    .sort((a, b) => a.due - b.due)
    .map((r) => ({ id: r.id, wordId: r.wordId, dir: r.dir, isNew: false }));

  let room = Math.max(0, settings.newPerDay - introducedToday);
  // 反向卡：只給「已經學過正向」的字；跟新字共用每日上限，但最多佔一半（第 1.3 批主對話修正：
  // 以前新字先把額度用完，詞表有一千多字時反向卡永遠排不進來，打字作答就永遠不會出現）
  const rev = [];
  if (settings.reverse) {
    const revRoom = Math.ceil(room / 2);
    for (const w of vocab) {
      if (rev.length >= revRoom) break;
      if (isFamiliar(w, settings.familiarOverride)) continue;
      if (!sourceEnabled(w, settings.sources)) continue; // 來源關掉的那層，反向新卡也不出；已在複習中的到期卡不受影響（第 2a.1 批）
      if (w.layer === "abbr") continue; // 網路用語先不入題，不產生反向卡（他 2026-11-11 的決定）
      const fRec = cards.get(cardId(w.id, "f"));
      if (fRec && fRec.added != null && dayKey(new Date(fRec.added)) === dayKey(now)) continue; // 今天才學的字，明天再出反向卡（1.3 審核建議）
      if (fRec && !cards.has(cardId(w.id, "r"))) {
        rev.push({ id: cardId(w.id, "r"), wordId: w.id, dir: "r", isNew: true });
      }
    }
    room -= rev.length;
  }
  const fresh = [];
  for (const w of orderNew(vocab, settings.sources, settings.familiarOverride)) {
    if (room <= 0) break;
    if (!cards.has(cardId(w.id, "f"))) {
      fresh.push({ id: cardId(w.id, "f"), wordId: w.id, dir: "f", isNew: true });
      room--;
    }
  }
  fresh.push(...rev);
  return { due, fresh, queue: [...due, ...fresh] };
}

// 回答一張卡：回傳 { rec, requeue }。rec 為 null（新卡）時從空白卡開始。
export function answer({ item, rec, grade, now = new Date() }) {
  const base = rec ?? (item.dir === "v" ? newVerbRecord(item.wordId, item.tense, now)
    : item.dir === "u" ? { ...newRecord(item.wordId, "u", now), unit: item.unit } // 文法題卡帶單元，備份還原後找得回來
    : newRecord(item.wordId, item.dir, now));
  const next = review(base, grade, now);
  return { rec: next, requeue: shouldRequeue(next, now) };
}

// 評分並存檔。存檔成功才更新畫面用的 cards；任何一步失敗都丟錯，由畫面顯示提示（審核 B6）。
export async function gradeCard({ store, cards, item, grade, now = new Date() }) {
  const { rec, requeue } = answer({ item, rec: cards.get(item.id) ?? null, grade, now });
  await store.saveCard(rec);
  await store.addLog({ id: `${now.getTime()}-${item.id}`, cardId: item.id, grade, at: now.getTime() });
  if (item.isNew) { // 動詞卡另外計數（key 是 new:v-日期，跟備份走）；一個新動詞有兩張新卡，只在現在式那張算 1 個
    if (item.dir === "f" || item.dir === "r") await store.bumpNew(dayKey(now)); // 只有單字卡算每日新字；文法題（u）、陰陽性（g，自己的流程不經過這裡）都不算
    else if (item.tense === "pres") await store.bumpNew(`v-${dayKey(now)}`);
  }
  cards.set(rec.id, rec);
  return { rec, requeue };
}

export const GRADE_FAIL_MESSAGE = "這一題沒有存到。請完全關掉 App 再重新開啟；如果一直這樣，先到設定匯出備份。";

// 評一張卡並推進佇列（不碰畫面）：成功才把這張從佇列拿掉（要重排的放回尾端）；失敗時佇列原封不動，由畫面顯示提示（審核 B6、A2）。
export async function gradeStep({ store, cards, queue, grade, now = new Date() }) {
  const item = queue[0];
  try {
    const { requeue } = await gradeCard({ store, cards, item, grade, now });
    queue.shift();
    if (requeue) queue.push({ ...item, isNew: false });
    return { ok: true, requeue };
  } catch (e) {
    return { ok: false, error: e, message: GRADE_FAIL_MESSAGE };
  }
}
