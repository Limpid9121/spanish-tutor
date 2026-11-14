// 讀課程內容。App 只讀 content/，不在程式裡寫死西文。
const VOCAB_FILES = ["content/vocab/core300.json", "content/vocab/social-abbr.json"];
let cache;

export async function loadVocab() {
  if (!cache) {
    const lists = await Promise.all(VOCAB_FILES.map(async (f) => {
      const res = await fetch(f);
      if (!res.ok) throw new Error(`讀不到 ${f}（${res.status}）`);
      return res.json();
    }));
    const vocab = lists.flat();
    cache = { vocab, byId: new Map(vocab.map((w) => [w.id, w])) };
  }
  return cache;
}

// 陰陽性陷阱（第 1.4 批）：{ groups, words, byId }。跟單字表分開載入，只有專區用到。
let genderCache;
export async function loadGenderTraps() {
  if (!genderCache) {
    const res = await fetch("content/gender-traps.json");
    if (!res.ok) throw new Error(`讀不到 content/gender-traps.json（${res.status}）`);
    const d = await res.json();
    genderCache = { groups: d.groups, words: d.words, byId: new Map(d.words.map((w) => [w.id, w])) };
  }
  return genderCache;
}

// 文法單元（第 3a 批）：{ units, unitById, unitData, drillById }。units 是單元地圖（units.json），
// unitData 是 ready 的單元檔 { id: 內容 }，drillById 是 題目id → { drill, unit }。讀不到就丟錯，由文法分頁顯示，不影響單字與動詞。
let grammarCache;
export async function loadGrammar() {
  if (!grammarCache) {
    const get = async (f) => {
      const res = await fetch(f);
      if (!res.ok) throw new Error(`讀不到 ${f}（${res.status}）`);
      return res.json();
    };
    const units = await get("content/grammar/units.json");
    const files = await Promise.all(units.filter((u) => u.ready).map((u) => get(`content/grammar/${u.id}.json`)));
    const unitData = Object.fromEntries(files.map((f) => [f.id, f]));
    const drillById = new Map(files.flatMap((f) => f.drills.map((d) => [d.id, { drill: d, unit: f.id }])));
    grammarCache = { units, unitById: new Map(units.map((u) => [u.id, u])), unitData, drillById };
  }
  return grammarCache;
}

// 動詞變化（第 2a 批）：{ tenses, groups, verbs, byId }。只有「動詞」分頁用到，跟單字表分開載入。
let verbCache;
export async function loadVerbs() {
  if (!verbCache) {
    const res = await fetch("content/verbs.json");
    if (!res.ok) throw new Error(`讀不到 content/verbs.json（${res.status}）`);
    const d = await res.json();
    verbCache = { ...d, byId: new Map(d.verbs.map((v) => [v.id, v])) };
  }
  return verbCache;
}
