// 進度存放：IndexedDB（手機上）或記憶體（測試用）。兩者介面相同。
import { DEFAULT_SETTINGS } from "./session.js";

export const STORES = { cards: "id", meta: "key", log: "id", reports: "id" };
const DB_VERSION = 2; // 2：新增 reports（回報錯誤）

export function memoryBackend() {
  const data = Object.fromEntries(Object.keys(STORES).map((s) => [s, new Map()]));
  const copy = (v) => (v === undefined ? undefined : structuredClone(v));
  return {
    async get(store, key) { return copy(data[store].get(key)); },
    async getAll(store) { return [...data[store].values()].map(copy); },
    async put(store, value) { data[store].set(value[STORES[store]], copy(value)); },
    async putAll(store, values) { for (const v of values) data[store].set(v[STORES[store]], copy(v)); },
    async delete(store, key) { data[store].delete(key); },
    async clear(store) { data[store].clear(); },
    // 一次取代所有進度：全有或全無。先把要寫的東西全部複製好（出錯就在這裡丟，原本的資料沒動），最後才換掉。
    async replaceAll({ cards = [], log = [], reports = [], metaDeletePrefix = "new:", metaPut = [] }) {
      const next = {
        cards: new Map(cards.map((v) => [v.id, copy(v)])),
        log: new Map(log.map((v) => [v.id, copy(v)])),
        reports: new Map(reports.map((v) => [v.id, copy(v)])),
        meta: new Map([...data.meta].filter(([k]) => !k.startsWith(metaDeletePrefix))),
      };
      for (const m of metaPut) next.meta.set(m.key, copy(m));
      for (const k of Object.keys(next)) data[k] = next[k];
    },
  };
}

// factory：IndexedDB 的入口（預設是瀏覽器的 indexedDB；測試時傳假的）
// 交易失敗時的錯誤物件：依規格，request 的 error 事件先冒泡到交易，這時 transaction.error 還是 null（審核 B2），
// 所以優先用 event.target.error，再退到 transaction.error，最後一定給一個 Error，呼叫端的 e.message 才不會再丟 TypeError。
export function txError(t, ev, fallback = "儲存空間寫入失敗") {
  const e = ev?.target?.error ?? t?.error;
  return e instanceof Error || (e && typeof e === "object" && "message" in e) ? e : new Error(fallback);
}

// 這幾種是「這筆資料有問題」，不是連線壞了：不必重新連線
const DATA_ERRORS = new Set(["DataError", "ConstraintError", "DataCloneError", "QuotaExceededError", "TypeError", "NotFoundError"]);
export const OPEN_TIMEOUT_MS = 10000;

// factory：IndexedDB 的入口（預設是瀏覽器的 indexedDB；測試時傳假的）
export function idbBackend(name = "spanish-tutor", factory = globalThis.indexedDB, { openTimeoutMs = OPEN_TIMEOUT_MS } = {}) {
  let dbp;
  const reset = () => { dbp = undefined; };
  const open = () => (dbp ??= new Promise((resolve, reject) => {
    let req, timer, done = false;
    const fail = (e) => { if (done) return; done = true; clearTimeout(timer); reject(e); };
    // 逾時：開 IndexedDB 可能被別的分頁／舊連線擋住而一直沒有回應，不能讓畫面永遠空白
    timer = setTimeout(() => fail(new Error("儲存空間一直沒有回應（可能被另一個開著的分頁擋住）")), openTimeoutMs);
    try { req = factory.open(name, DB_VERSION); } catch (e) { fail(e); return; }
    req.onupgradeneeded = () => {
      for (const [s, keyPath] of Object.entries(STORES)) {
        if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath });
      }
    };
    req.onblocked = () => fail(new Error("儲存空間被另一個開著的分頁擋住了，請關掉其他分頁再試"));
    req.onsuccess = () => {
      const db = req.result;
      if (done) { try { db.close(); } catch { /* 已經逾時：不要留下用不到的連線 */ } return; }
      done = true;
      clearTimeout(timer);
      // iOS 會在 App 放背景一陣子後關掉連線：連線被關或要升級時，丟掉快取的連線，下次重新開
      db.onclose = reset;
      db.onversionchange = () => { reset(); try { db.close(); } catch { /* 忽略 */ } };
      resolve(db);
    };
    req.onerror = (ev) => fail(txError(req, ev, "儲存空間打不開"));
  })).catch((e) => { reset(); throw e; }); // 開不起來也不能把失敗永遠快取住
  async function once(stores, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode); // 連線已經被關掉時，這裡會直接丟 InvalidStateError
      let req;
      try {
        req = fn(t);
      } catch (e) {
        // 同步失敗（例如資料缺主鍵丟 DataError）：交易沒取消就會自動提交，前面已送出的 clear() 會生效（審核 B1），所以一定要 abort
        try { t.abort(); } catch { /* 交易已經結束 */ }
        reject(e);
        return;
      }
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = (ev) => reject(txError(t, ev));
      t.onabort = (ev) => reject(txError(t, ev, "儲存交易被取消了"));
    });
  }
  async function run(stores, mode, fn) {
    try {
      return await once(stores, mode, fn);
    } catch (e) {
      if (DATA_ERRORS.has(e?.name)) throw e; // 資料錯誤：連線沒壞，直接丟給呼叫端
      reset(); // 其他錯誤（InvalidStateError、UnknownError…）：丟掉舊連線，下次重新開
      if (e?.name !== "InvalidStateError") throw e;
      return once(stores, mode, fn); // 連線失效：重新開、再試一次（只試一次）
    }
  }
  const one = (store, mode, fn) => run(store, mode, (t) => fn(t.objectStore(store)));
  return {
    get: (store, key) => one(store, "readonly", (s) => s.get(key)),
    getAll: (store) => one(store, "readonly", (s) => s.getAll()),
    put: (store, value) => one(store, "readwrite", (s) => s.put(value)),
    putAll: (store, values) => one(store, "readwrite", (s) => { let last; for (const v of values) last = s.put(v); return last; }),
    delete: (store, key) => one(store, "readwrite", (s) => s.delete(key)),
    clear: (store) => one(store, "readwrite", (s) => s.clear()),
    // 一次取代所有進度：同一個交易裡清掉再寫入。任何一步失敗（同步丟錯由 once() abort、非同步錯誤由瀏覽器自動 abort），舊資料原封不動
    replaceAll: ({ cards = [], log = [], reports = [], metaDeletePrefix = "new:", metaPut = [] }) => run(Object.keys(STORES), "readwrite", (t) => {
      for (const s of ["cards", "log", "reports"]) t.objectStore(s).clear();
      const meta = t.objectStore("meta");
      const cur = meta.openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) { if (String(c.key).startsWith(metaDeletePrefix)) c.delete(); c.continue(); return; }
        for (const m of metaPut) meta.put(m); // 舊的 new: 全部刪完之後才寫新的，不然會被游標刪掉
      };
      for (const v of cards) t.objectStore("cards").put(v);
      for (const v of log) t.objectStore("log").put(v);
      for (const v of reports) t.objectStore("reports").put(v);
      return null;
    }),
  };
}

export class Store {
  constructor(backend) { this.b = backend; this.queue = Promise.resolve(); }

  async getMeta(key) { return (await this.b.get("meta", key))?.value; }
  async setMeta(key, value) { await this.b.put("meta", { key, value }); }

  async settings() { return { ...DEFAULT_SETTINGS, ...((await this.getMeta("settings")) ?? {}) }; }
  // 設定是「讀出來、合併、寫回去」，連續快速儲存時要排隊，不然後一次會把前一次蓋掉
  saveSettings(patch) { return this.updateSettings(() => patch); }
  // fn(目前設定) → 要合併的 patch；整個讀、改、寫排在同一個佇列裡，所以像「標一個字已熟悉」這種要看舊值的更新不會互相蓋掉
  updateSettings(fn) {
    const run = this.queue.then(async () => {
      const cur = await this.settings();
      const next = { ...cur, ...fn(cur) };
      await this.setMeta("settings", next);
      return next;
    });
    this.queue = run.catch(() => {}); // 前一次失敗不能讓後面的永遠卡住
    return run;
  }
  // 標一個字「已熟悉」（true）、加回學習（false）或回到內容預設（null）。存在設定裡，跟備份走。
  setFamiliar(id, value) {
    return this.updateSettings((cur) => {
      const fo = { ...(cur.familiarOverride ?? {}) };
      if (value === null) delete fo[id]; else fo[id] = value === true;
      return { familiarOverride: fo };
    });
  }

  async cards() { return new Map((await this.b.getAll("cards")).map((r) => [r.id, r])); }
  saveCard(rec) { return this.b.put("cards", rec); }
  addLog(entry) { return this.b.put("log", entry); }

  reports() { return this.b.getAll("reports"); }
  addReport(rep) { return this.b.put("reports", rep); }

  async newCount(day) { return (await this.getMeta(`new:${day}`)) ?? 0; }
  async bumpNew(day) { await this.setMeta(`new:${day}`, (await this.newCount(day)) + 1); }
}
