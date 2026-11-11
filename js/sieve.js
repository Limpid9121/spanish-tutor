// 快速篩字（第 1.1b 批決定 15、16）：一次一個西文字，「會」的標成已熟悉（不進新字佇列），「不會」的照常學。
// 這個檔案只有純函式（不碰畫面），方便測試。狀態存在設定的 sieve 欄位，跟備份走：
//   sieve = { status: "active" | "skipped" | "done", seen: { 字id: 1（會）| 0（不會） } }
//   settings.sieve 沒有＝還沒開始過（第一次使用時就是這樣）
import { orderNew } from "./session.js";

// 候選字（順序＝新字順序）：把篩字自己標成「會」的覆蓋先拿掉再排，這樣「會」的字還算在總數裡，進度不會一路縮水
export function sieveCandidates(vocab, settings) {
  const seen = settings.sieve?.seen ?? {};
  const base = { ...(settings.familiarOverride ?? {}) };
  for (const id of Object.keys(seen)) if (seen[id] === 1 && base[id] === true) delete base[id];
  return orderNew(vocab, settings.sources, base);
}

// 下一個要問的字；cards：已經有卡片的字不再問。回傳 { word, done（已篩幾個）, total } 或 null（沒有了）
export function sieveNext(vocab, settings, cards = new Map()) {
  const seen = settings.sieve?.seen ?? {};
  const cand = sieveCandidates(vocab, settings).filter((w) => !cards.has(`${w.id}:f`));
  const word = cand.find((w) => seen[w.id] === undefined);
  const done = cand.filter((w) => seen[w.id] !== undefined).length;
  return word ? { word, done, total: cand.length } : null;
}

export function sieveProgress(vocab, settings, cards = new Map()) {
  const n = sieveNext(vocab, settings, cards);
  if (n) return { done: n.done, total: n.total, finished: false };
  const cand = sieveCandidates(vocab, settings).filter((w) => !cards.has(`${w.id}:f`));
  return { done: cand.length, total: cand.length, finished: true };
}

// 第一次使用（從來沒篩過也沒跳過、也還沒有任何卡片）要出現篩字
export function shouldOfferSieve(settings, cardCount) {
  return !settings.sieve && cardCount === 0;
}

export function sieveStatus(settings) {
  return settings.sieve?.status ?? null;
}

// 「上一個」：目前畫面上這個字的前一個候選字（順序＝新字順序）；第一個字回 null（畫面不顯示鍵）。
// 按了之後重答，會覆蓋剛才的結果（answerSieve 處理）。
export function sievePrev(vocab, settings, cards = new Map(), currentId = null) {
  const cand = sieveCandidates(vocab, settings).filter((w) => !cards.has(`${w.id}:f`));
  const i = currentId === null ? cand.length : cand.findIndex((w) => w.id === currentId);
  return i > 0 ? cand[i - 1] : null;
}

// 這個字在候選裡排第幾（從 1 算），畫面顯示「第 N ／ 共 M」用
export function sieveIndex(vocab, settings, cards, wordId) {
  const cand = sieveCandidates(vocab, settings).filter((w) => !cards.has(`${w.id}:f`));
  return { index: cand.findIndex((w) => w.id === wordId) + 1, total: cand.length };
}

// 回答一個字：會→標已熟悉（familiarOverride 設 true）；不會→只記下問過了。存檔失敗會丟錯。
// 重答（按了「上一個」）：原本篩字標了「會」、現在改「不會」，要把已熟悉拿掉；他在單字頁自己標的不動。
export function answerSieve(store, wordId, knows) {
  return store.updateSettings((cur) => {
    const seen = { ...(cur.sieve?.seen ?? {}), [wordId]: knows ? 1 : 0 };
    const fo = { ...(cur.familiarOverride ?? {}) };
    if (knows) fo[wordId] = true;
    else if (cur.sieve?.seen?.[wordId] === 1 && fo[wordId] === true) delete fo[wordId];
    return { familiarOverride: fo, sieve: { status: "active", seen } };
  });
}

export function skipSieve(store) {
  return store.updateSettings((cur) => ({ sieve: { status: "skipped", seen: { ...(cur.sieve?.seen ?? {}) } } }));
}

export function finishSieve(store) {
  return store.updateSettings((cur) => ({ sieve: { status: "done", seen: { ...(cur.sieve?.seen ?? {}) } } }));
}

// 重跑：保留「會」的結果（那些字已經是已熟悉），清掉「不會」的紀錄讓它們再被問一次
export function restartSieve(store) {
  return store.updateSettings((cur) => {
    const seen = {};
    for (const [id, v] of Object.entries(cur.sieve?.seen ?? {})) if (v === 1) seen[id] = 1;
    return { sieve: { status: "active", seen } };
  });
}
