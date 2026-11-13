// 動詞變化表（第 2a 批）的純函式：哪幾格要標色、底線位置、分區、唸出來的字。不碰畫面。
// 資料來自 content/verbs.json（由 tools/build_verbs.py 產生，每個形都對照過 allforms）。
export const PERSON_LABELS = ["yo", "tú", "él／ella", "nosotros", "vosotros", "ellos／ellas"];
export const REFLEXIVE_PRONOUNS = ["me", "te", "se", "nos", "os", "se"];
export const VOSOTROS = 4; // 第 5 格：西班牙用，變化表淡色顯示
const ALSO_LABEL = { "e-ie": "e→ie", "o-ue": "o→ue", "u-ue": "u→ue", "e-i": "e→i" };

// 實際的形 vs 基準形（照最普通的規則推出來的）：回傳實際字串裡「不一樣」的範圍 [起, 止)，一樣就回 null。
// 做法：去掉共同的開頭與結尾，剩下的中間就是變的字母；若變的只是 i／u 加上相鄰的 e（ie、ue 雙母音），整個雙母音一起標。
export function changedRange(base, actual) {
  if (base === actual) return null;
  const max = Math.min(base.length, actual.length);
  let pre = 0;
  while (pre < max && base[pre] === actual[pre]) pre++;
  let suf = 0;
  while (suf < max - pre && base[base.length - 1 - suf] === actual[actual.length - 1 - suf]) suf++;
  let s = pre;
  let e = actual.length - suf;
  if (s === e) { // 實際的形只是少了字母（沒有東西可標）：標前一個字，避免空範圍
    s = Math.max(0, s - 1);
    return [s, Math.max(e, s + 1)];
  }
  const seg = actual.slice(s, e);
  if (seg === "i" && actual[e] === "e") e += 1;                       // pienso：ie
  else if (seg === "e" && s > 0 && actual[s - 1] === "u") s -= 1;     // juegas：ue
  return [s, e];
}

// 把字依範圍切成 [前, 標記, 後]
export function splitByRange(text, range) {
  if (!range) return [text, "", ""];
  return [text.slice(0, range[0]), text.slice(range[0], range[1]), text.slice(range[1])];
}

// 6 格現在式的顯示資料。反身動詞的代名詞另外給（pronoun），變的字母只看動詞本身的形。
export function cellMarks(verb) {
  return verb.pres.map((form, i) => {
    const whole = verb.group === "irregular"; // 完全不規則：整格標色、不標個別字母（基準形不存在，比出來的底線沒意義；2a 審核 B4、B5）
    const irregular = whole || verb.irregularForms.includes(i);
    const range = irregular && !whole ? changedRange(verb.plain.pres[i], form) : null;
    return {
      index: i,
      label: PERSON_LABELS[i],
      pronoun: verb.reflexive ? REFLEXIVE_PRONOUNS[i] : "",
      form,
      irregular,
      parts: splitByRange(form, range),
      dim: i === VOSOTROS,
    };
  });
}

export function gerMark(verb) {
  const range = verb.gerIrregular ? changedRange(verb.plain.ger, verb.ger) : null;
  return { form: verb.ger, irregular: !!verb.gerIrregular, parts: splitByRange(verb.ger, range) };
}

// 喇叭唸的字：反身動詞連代名詞一起唸（me llamo）
export function speakText(verb, i) {
  return verb.reflexive ? `${REFLEXIVE_PRONOUNS[i]} ${verb.pres[i]}` : verb.pres[i];
}

// 現在分詞接上代名詞要補重音：acostando → acostándome、leyendo → leyéndome（重音落在原本的重音位置）
export function attachToGerund(ger, pronoun) {
  const accented = ger.replace(/(a|ie|ye)ndo$/, (m) => ({ a: "á", ie: "ié", ye: "yé" })[m.slice(0, -3)] + "ndo");
  return accented + pronoun;
}

// 用進行式不自然的反身動詞：只顯示分詞，不帶 me estoy … 的例子（llamarse 是「名字叫」，要用現在式 me llamo）
export const NO_PROGRESSIVE_EXAMPLE = new Set(["llamarse"]);

// 反身動詞的進行式有兩種位置：代名詞放 estar 前（me estoy acostando）或接在分詞後面（estoy acostándome）。
// estar 的 yo 形取自資料（已對照過 allforms）。非反身動詞、llamarse 沒有例子（回傳 null）。
export function gerundNote(verb, estar) {
  if (!verb.reflexive || !estar || NO_PROGRESSIVE_EXAMPLE.has(verb.inf)) return null;
  const pron = REFLEXIVE_PRONOUNS[0];
  return { before: `${pron} ${estar.pres[0]} ${verb.ger}`, after: `${estar.pres[0]} ${attachToGerund(verb.ger, pron)}` };
}

// 同時有詞根變化的標示：tener ＋e→ie
export function alsoLabel(verb) {
  return (verb.also ?? []).map((a) => `＋${ALSO_LABEL[a] ?? a}`).join(" ");
}

// 依組別順序分區；沒有動詞的組不出現
export function groupSections(data) {
  return data.groups
    .map((group) => ({ group, verbs: data.verbs.filter((v) => v.group === group.id) }))
    .filter((s) => s.verbs.length);
}

export function findVerb(data, id) {
  return data.verbs.find((v) => v.id === id);
}
