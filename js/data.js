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
