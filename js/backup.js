// 匯出／匯入備份（JSON）。匯入前先驗證格式，驗證過才會動到現有資料；匯入是一次完成（全有或全無）。
import { DEFAULT_SETTINGS } from "./session.js";

export const BACKUP_VERSION = 1; // reports 是後來加的選用欄位（沒有就當作 0 筆），所以版本不用升
const APP = "spanish-tutor";

export async function buildBackup(store, now = new Date()) {
  const meta = await store.b.getAll("meta");
  const newCounts = {};
  for (const m of meta) if (m.key.startsWith("new:")) newCounts[m.key.slice(4)] = m.value;
  return {
    app: APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    settings: await store.settings(),
    newCounts,
    cards: (await store.b.getAll("cards")).sort((a, b) => a.id.localeCompare(b.id)),
    log: (await store.b.getAll("log")).sort((a, b) => a.id.localeCompare(b.id)),
    reports: (await store.b.getAll("reports")).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

const CARD_NUMS = ["due", "stability", "difficulty", "scheduled_days", "reps", "lapses", "learning_steps", "state", "added"];

export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error("這不是有效的備份檔（讀不出 JSON）。"); }
  if (!obj || obj.app !== APP) throw new Error("這不是西語家教的備份檔。");
  if (obj.version !== BACKUP_VERSION) throw new Error(`備份檔版本 ${obj.version} 不支援（需要 ${BACKUP_VERSION}）。`);
  if (!Array.isArray(obj.cards) || !Array.isArray(obj.log)) throw new Error("備份檔內容不完整。");
  const ids = new Set();
  for (const c of obj.cards) {
    if (typeof c?.id !== "string" || typeof c.wordId !== "string" || !["f", "r", "g", "v", "u"].includes(c.dir)) throw new Error("備份檔裡有格式錯誤的卡片。");
    if (c.dir === "v" && typeof c.tense !== "string") throw new Error(`備份檔裡的動詞卡片 ${c.id} 缺少時態。`); // 動詞卡（第 2b 批）：dir v、帶 tense
    if (c.dir === "u" && typeof c.unit !== "string") throw new Error(`備份檔裡的文法題卡片 ${c.id} 缺少單元。`); // 文法題卡（第 3a 批）：dir u、帶 unit
    for (const k of CARD_NUMS) if (typeof c[k] !== "number" || Number.isNaN(c[k])) throw new Error(`備份檔裡的卡片 ${c.id} 欄位 ${k} 有誤。`);
    // last_review：新卡沒有上次複習時間（null），其他要是數字
    if (c.last_review !== null && (typeof c.last_review !== "number" || Number.isNaN(c.last_review))) throw new Error(`備份檔裡的卡片 ${c.id} 欄位 last_review 有誤。`);
    if (ids.has(c.id)) throw new Error(`備份檔裡的卡片 ${c.id} 重複了。`);
    ids.add(c.id);
  }
  for (const l of obj.log) if (typeof l?.id !== "string") throw new Error("備份檔裡有格式錯誤的複習紀錄。");
  if (obj.reports !== undefined) {
    if (!Array.isArray(obj.reports)) throw new Error("備份檔裡的回報格式錯誤。");
    for (const r of obj.reports) {
      if (typeof r?.id !== "string" || typeof r.wordId !== "string" || typeof r.reason !== "string") throw new Error("備份檔裡有格式錯誤的回報。");
    }
  }
  return obj;
}

// 用備份取代目前所有進度：交給 store 在同一個交易裡一次完成，中途失敗舊進度不會動（審核 B3）
export async function restoreBackup(store, obj) {
  await store.b.replaceAll({
    cards: obj.cards,
    log: obj.log,
    reports: obj.reports ?? [],
    metaDeletePrefix: "new:",
    metaPut: [
      ...Object.entries(obj.newCounts ?? {}).map(([day, n]) => ({ key: `new:${day}`, value: n })),
      { key: "settings", value: { ...DEFAULT_SETTINGS, ...(obj.settings ?? {}) } },
    ],
  });
}
