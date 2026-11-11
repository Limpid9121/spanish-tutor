// 複習排程：包 ts-fsrs（vendor/ts-fsrs.umd.js，全域 FSRS）。不自己寫演算法。
// 卡片紀錄是純物件（可直接存 IndexedDB／JSON）；due、last_review 一律存毫秒數。

export const GRADES = [
  { value: 1, key: "again", label: "忘了" },
  { value: 2, key: "hard", label: "困難" },
  { value: 3, key: "good", label: "記得" },
  { value: 4, key: "easy", label: "簡單" },
];

const MIN = 60 * 1000;
export const LEARN_AHEAD_MS = 20 * MIN; // 評分後 20 分鐘內又到期的卡，本次複習再出現一次
const DAY_START_HOUR = 4; // 凌晨 4 點前仍算前一天（跟 Anki 一樣）

let scheduler;
function fsrs() {
  const FS = globalThis.FSRS;
  if (!FS) throw new Error("找不到 FSRS（vendor/ts-fsrs.umd.js 沒載入）");
  scheduler ??= FS.fsrs(FS.generatorParameters({ enable_fuzz: false }));
  return scheduler;
}

export function cardId(wordId, dir) {
  return `${wordId}:${dir}`; // dir：f＝看西文想中文、r＝看中文想西文
}

function toFsrsCard(rec) {
  return {
    due: new Date(rec.due),
    stability: rec.stability,
    difficulty: rec.difficulty,
    scheduled_days: rec.scheduled_days,
    reps: rec.reps,
    lapses: rec.lapses,
    learning_steps: rec.learning_steps,
    state: rec.state,
    last_review: rec.last_review == null ? undefined : new Date(rec.last_review),
  };
}

function toRecord(base, card) {
  return {
    ...base,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps,
    state: card.state, // 0 新、1 學習中、2 複習、3 重學
    last_review: card.last_review ? card.last_review.getTime() : null,
  };
}

export function newRecord(wordId, dir, now = new Date()) {
  const empty = globalThis.FSRS.createEmptyCard(now);
  return toRecord({ id: cardId(wordId, dir), wordId, dir, added: now.getTime() }, empty);
}

// 評分：回傳新的卡片紀錄（不改原本那份）
export function review(rec, grade, now = new Date()) {
  if (![1, 2, 3, 4].includes(grade)) throw new Error(`評分只能是 1～4：${grade}`);
  const { card } = fsrs().next(toFsrsCard(rec), now, grade);
  const { due, stability, difficulty, scheduled_days, reps, lapses, learning_steps, state, last_review, ...base } = rec;
  return toRecord(base, card);
}

// 四個鍵各自會排到什麼時候（毫秒時間戳），不改紀錄
export function preview(rec, now = new Date()) {
  const r = fsrs().repeat(toFsrsCard(rec), now);
  return { 1: r[1].card.due.getTime(), 2: r[2].card.due.getTime(), 3: r[3].card.due.getTime(), 4: r[4].card.due.getTime() };
}

// 「學習日」：凌晨 4 點前算前一天。回傳 YYYY-MM-DD（本機時區）
export function dayKey(now = new Date()) {
  const d = new Date(now.getTime() - DAY_START_HOUR * 60 * MIN);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 這個學習日結束的時間點（下一個凌晨 4 點）
export function endOfStudyDay(now = new Date()) {
  const d = new Date(now.getTime() - DAY_START_HOUR * 60 * MIN);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, DAY_START_HOUR, 0, 0, 0).getTime();
}

// 學習中／重學中的卡：到點才算到期；複習卡：只要排在今天（學習日結束前）就算到期
export function isDue(rec, now = new Date()) {
  if (rec.state === 0) return false;
  if (rec.state === 2) return rec.due < endOfStudyDay(now);
  return rec.due <= now.getTime();
}

export function shouldRequeue(rec, now = new Date()) {
  return (rec.state === 1 || rec.state === 3) && rec.due <= now.getTime() + LEARN_AHEAD_MS;
}
