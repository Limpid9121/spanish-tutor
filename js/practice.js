// 作答方式的純函式（第 1.3 批）：打字比對、建議評分、選擇題選項。不碰畫面和資料庫。
// 評分仍由使用者按四個鍵決定；這裡只算「建議」。
import { article, foldAccents, splitZh } from "./words.js";
import { DEFAULT_SETTINGS, isFamiliar } from "./session.js";

const ART = { m: ["el", "un", "los", "unos"], f: ["la", "una", "las", "unas"] };
const ALL_ART = [...ART.m, ...ART.f];
const ACCENTED = /[áéíóúñüÁÉÍÓÚÑÜ]/;

// 去頭尾空白、小寫、空白合併成一格、去掉句首的 ¿¡ 和句尾的標點。比對用 NFC（iOS 輸入框有時送出 字母＋組合重音）。
function norm(s) {
  return String(s ?? "").normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ")
    .replace(/^[¿¡\s]+/, "").replace(/[?!.,;:\s]+$/, "").trim();
}

// 這個名詞可以搭配哪些冠詞：陽性 el／un／los／unos，陰性 la／una／las／unas；
// el agua 這類（單數用 el 的陰性名詞）用 el／un，不收 la。沒有性別資料就都收。
// 男女同形的名詞（el／la turista）：釋義裡寫「男女同形」。víctima、persona 寫的是「都用陰性」，不算。（1.3 審核必修 1）
export function commonGender(word) {
  return word.pos === "n" && /男女同形/.test(word.zh ?? "");
}

function allowedArticles(word) {
  if (word.gender !== "m" && word.gender !== "f") return ALL_ART;
  if (commonGender(word)) return ALL_ART;
  if (word.gender === "f" && article(word) === "el") return ["el", "un", "una", "las", "unas"]; // el agua：單數不用 la
  return ART[word.gender];
}

export function checkTyped(input, word) {
  const a = commonGender(word) ? "el／la" : article(word);
  const expected = a ? `${a} ${word.es}` : word.es;
  const forms = [...new Set([norm(word.es), ...word.es.split(/[、,，]/).map(norm)].filter(Boolean))];
  const typed = norm(input);
  if (!typed) return { result: "wrong", expected };
  const inputs = [typed];
  if (word.pos === "n") {
    const [first, ...rest] = typed.split(" ");
    if (rest.length && allowedArticles(word).includes(first)) inputs.push(rest.join(" "));
  }
  if (inputs.some((x) => forms.includes(x))) return { result: "exact", expected };
  const folded = forms.map(foldAccents);
  if (inputs.some((x) => folded.includes(foldAccents(x)))) return { result: "accent", expected };
  return { result: "wrong", expected };
}

// 把正確拼法切成片段，有重音（含 ñ、ü）的字母 mark: true，畫面用來標出來。
export function accentSegments(text) {
  const segs = [];
  for (const ch of String(text).normalize("NFC")) {
    const mark = ACCENTED.test(ch);
    const last = segs[segs.length - 1];
    if (last && last.mark === mark) last.text += ch;
    else segs.push({ text: ch, mark });
  }
  return segs;
}

// 建議評分：打字 exact→3、accent→2、wrong→1；選擇題 correct→3、incorrect→1
export function suggestGrade(result) {
  const g = { exact: 3, accent: 2, wrong: 1, correct: 3, incorrect: 1 }[result];
  if (g == null) throw new Error(`不認得的作答結果：${result}`);
  return g;
}

// 出題用的中文（打字題的題面、選擇題的選項）：釋義第一個「；」之前，再去掉會洩漏答案的部分（1.3 審核必修 2）：
// 括號說明（「觀光客（el turista…）」）、開頭的「xq＝」，最後把殘留的西文答案遮成「～」。全部去光就退回原文遮字。
export function promptText(word) {
  const main = splitZh(word.zh ?? "").main;
  const mask = (s) => {
    let out = s;
    for (const f of String(word.es ?? "").split(/[、,，]/).map((x) => x.trim()).filter((x) => x.length >= 2)) {
      const re = new RegExp(`(^|[^\\p{L}])${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^\\p{L}]|$)`, "giu");
      out = out.replace(re, (_, pre) => `${pre}～`);
    }
    return out;
  };
  const stripped = main.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").replace(/^[^＝=]*[A-Za-zÀ-ÿ][^＝=]*[＝=]/, "").trim();
  return mask(stripped || main).trim() || main;
}

export function choiceText(word) {
  return promptText(word);
}

function shuffled(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 這個字要不要出成打字題、選擇題：網路用語（abbr）先不入題（他 2026-11-11 的決定），正向卡維持翻面
export function inQuiz(word) {
  return word.layer !== "abbr";
}

// 4 個中文選項（含正解，順序隨機）：[{ text, correct, wordId }]。
// 干擾項優先序：同詞性＋同 layer → 同詞性 → 同 layer → 任意；先排除中文相同或互相包含的、familiar 的字，
// 不夠才依序放寬（先放寬 familiar，再放寬「互相包含」，但中文完全相同的永遠不放進來）。
// 詞表真的湊不到 4 個不同的中文時，寧可少給，不編造。
// opts.familiarOverride：他自己改的已熟悉（同 settings.familiarOverride）。
export function makeChoices(word, vocab, rng = Math.random, opts = {}) {
  const correct = choiceText(word);
  const pool = vocab.filter((w) => w.id !== word.id && inQuiz(w) && choiceText(w));
  const fresh = pool.filter((w) => !isFamiliar(w, opts.familiarOverride));
  const chosen = [];
  const texts = new Set([correct]);
  const contains = (a, b) => a.includes(b) || b.includes(a);

  for (const strict of [true, false]) {
    for (const list of [fresh, pool]) {
      const tiers = [
        list.filter((w) => w.pos === word.pos && w.layer === word.layer),
        list.filter((w) => w.pos === word.pos),
        list.filter((w) => w.layer === word.layer),
        list,
      ];
      for (const tier of tiers) {
        for (const w of shuffled(tier, rng)) {
          if (chosen.length >= 3) break;
          const t = choiceText(w);
          if (texts.has(t)) continue;
          if (strict && [...texts].some((x) => contains(x, t))) continue;
          texts.add(t);
          chosen.push(w);
        }
      }
    }
  }
  const all = [
    { text: correct, correct: true, wordId: word.id },
    ...chosen.map((w) => ({ text: choiceText(w), correct: false, wordId: w.id })),
  ];
  return shuffled(all, rng);
}

// 設定裡的作答方式；缺的、不認得的值都視為預設
export function answerModeOf(settings) {
  const d = DEFAULT_SETTINGS.answerMode;
  const m = settings?.answerMode ?? {};
  return {
    r: m.r === "type" || m.r === "flip" ? m.r : d.r,
    f: m.f === "choice" || m.f === "flip" ? m.f : d.f,
  };
}
