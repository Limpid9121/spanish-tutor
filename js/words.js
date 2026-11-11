// 單字顯示用的小工具（純函式，可測試）。
const POS_ZH = {
  n: "名詞", v: "動詞", adj: "形容詞", adv: "副詞", pron: "代名詞", det: "限定詞",
  art: "冠詞", prep: "介系詞", conj: "連接詞", interj: "感嘆詞", contr: "縮合詞",
};
const GENDER_ZH = { m: "陽性", f: "陰性" };
// 陰性名詞但單數用 el（重音落在開頭的 a）：el agua、el arma、el hambre
export const EL_FEMININE = new Set(["agua", "arma", "hambre", "águila", "alma", "área", "aula", "hacha", "ala"]);

export function article(word) {
  if (word.pos !== "n" || !word.gender) return null;
  if (word.gender === "m") return "el";
  return EL_FEMININE.has(word.es) ? "el" : "la";
}

// 名詞帶冠詞：el libro、la casa；其他詞原樣
export function spanishWithArticle(word) {
  const a = article(word);
  return a ? `${a} ${word.es}` : word.es;
}

export function posLabel(word) {
  const p = POS_ZH[word.pos] ?? word.pos;
  return word.pos === "n" && word.gender ? `${p}・${GENDER_ZH[word.gender]}` : p;
}

// 中文釋義以「；」分成主要意思與補充
export function splitZh(zh) {
  const parts = zh.split("；").map((s) => s.trim()).filter(Boolean);
  return { main: parts[0] ?? "", more: parts.slice(1) };
}

export function lenClass(text) {
  const n = [...text].length;
  return n > 14 ? "len-14" : n > 10 ? "len-10" : "";
}

// 「記熟」＝複習間隔 21 天以上（Anki「成熟卡」的定義）
export const MATURE_DAYS = 21;

export function cardState(rec) {
  if (!rec) return "new";
  return rec.state === 2 && rec.scheduled_days >= MATURE_DAYS ? "known" : "learning";
}

// 搜尋不分重音：先拆成基底字母＋組合重音符號（NFD），再把重音符號拿掉。cancion 找得到 canción
export function foldAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesQuery(word, query) {
  const q = query.trim();
  if (!q) return true;
  return foldAccents(word.es).includes(foldAccents(q)) || word.zh.includes(q);
}

export function daysAgoText(ms, now = Date.now()) {
  if (!ms) return "尚未備份";
  const d = Math.floor((now - ms) / 86400000);
  return d <= 0 ? "今天" : `${d} 天前`;
}
