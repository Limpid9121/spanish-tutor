// 動詞分頁（第 2a 批）：#/verbs 依組別列動詞，#/verb/<id> 是現在式 6 個人稱表加現在分詞。
// 不規則的格子用低彩度底色標出，變的字母加底線；每一格有喇叭鍵。
import { h } from "../ui.js";
import { loadVerbs } from "../data.js";
import { lenClass } from "../words.js";
import { groupSections, cellMarks, gerMark, speakText, findVerb, gerundNote, alsoLabel } from "../verbs.js";
import { exampleBlocks, speakBtn } from "./card.js";

export async function renderVerbs(root) {
  const data = await loadVerbs();
  root.append(
    h("h1", { class: "title" }, "動詞"),
    h("p", { class: "note v-intro", lang: "zh-Hant" }, "現在式與現在分詞。點一個動詞看變化表；有底色和底線的字母，就是跟規則不一樣的地方。"),
    h("a", { class: "btn primary block verb-drill-entry", href: "#/verb-drill" }, "練習變化"), // 動詞分頁也要有入口（主對話 2b 決定：只放今日頁太難找）
  );
  for (const { group, verbs } of groupSections(data)) {
    root.append(h("section", { class: "g-group" },
      h("h2", { class: "g-title" }, group.title),
      h("p", { class: "g-rule", lang: "zh-Hant" }, group.rule.replace(/-(?=[a-záéíóúñ])/g, "‑")), // 不換行連字號：-áis 不會斷到下一行（2a 審核 B9）
      h("ul", { class: "list" }, verbs.map((v) =>
        h("li", {}, h("a", { href: `#/verb/${encodeURIComponent(v.id)}` },
          h("span", { class: "es", lang: "es" }, v.inf),
          h("span", { class: "zh", lang: "zh-Hant" }, v.zh.split("；")[0]),
          v.reflexive ? h("span", { class: "fam" }, "反身") : null,
          alsoLabel(v) ? h("span", { class: "fam" }, alsoLabel(v)) : null))))));
  }
}

// 一格的字：反身代名詞（淡色）＋ 前 ＋ 底線標記 ＋ 後
function formSpan(pronoun, parts, irregular) {
  const [pre, mid, post] = parts;
  return h("span", { class: `vf${irregular ? " irr" : ""}`, lang: "es" },
    pronoun ? h("span", { class: "vpron" }, `${pronoun} `) : null,
    pre, mid ? h("u", {}, mid) : null, post);
}

// 變化表的列（動詞頁與練習翻面後共用）。asked：練習翻面時標出被問的那一格 { tense, person, bad }；一般瀏覽時不傳。
const askedTag = (asked) => h("span", { class: "v-asked", lang: "zh-Hant" }, asked.bad ? "你答錯的這格" : "這一題");
export function presRows(v, asked = null) {
  return cellMarks(v).map((m) => {
    const hit = asked && asked.tense === "pres" && asked.person === m.index;
    return h("div", { class: `vrow${m.dim ? " dim" : ""}${hit ? ` asked${asked.bad ? " bad" : ""}` : ""}` },
      h("span", { class: "vp", lang: "zh-Hant" }, m.label),
      formSpan(m.pronoun, m.parts, m.irregular),
      hit ? askedTag(asked) : null,
      speakBtn(speakText(v, m.index), `播放 ${m.label} 的發音`));
  });
}
export function gerRow(v, asked = null) {
  const ger = gerMark(v);
  const hit = asked && asked.tense === "ger";
  return h("div", { class: `vrow${hit ? ` asked${asked.bad ? " bad" : ""}` : ""}` },
    h("span", { class: "vp", lang: "zh-Hant" }, "estar ＋"),
    formSpan("", ger.parts, ger.irregular),
    hit ? askedTag(asked) : null,
    speakBtn(v.ger, "播放現在分詞的發音"));
}

export async function renderVerb(root, ctx, id) {
  const data = await loadVerbs();
  const v = findVerb(data, id);
  if (!v) { root.append(h("a", { class: "back", href: "#/verbs" }, "‹ 動詞"), h("p", { class: "empty" }, "找不到這個動詞。")); return; }
  const group = data.groups.find((g) => g.id === v.group);
  const estar = findVerb(data, "vb-estar");
  const gnote = gerundNote(v, estar);
  const also = alsoLabel(v);

  root.append(
    h("a", { class: "back", href: "#/verbs" }, "‹ 動詞"),
    h("p", { class: "pos" }, [group?.title, also].filter(Boolean).join(" ")),
    h("div", { class: "rv-head" }, h("h1", { class: `word ${lenClass(v.inf)}`, lang: "es" }, v.inf), speakBtn(v.inf)),
    h("p", { class: "meaning v-zh", lang: "zh-Hant" }, v.zh),
    h("h2", { class: "g-title v-sub" }, "現在式"),
    h("div", { class: "vtable" }, presRows(v)),
    h("p", { class: "note", lang: "zh-Hant" }, "vosotros 是西班牙用的；拉丁美洲用 ustedes（用 ellos／ellas 的形）。usted 用 él／ella 的形。"),
    ...(v.reflexive ? [h("p", { class: "note", lang: "zh-Hant" }, "反身動詞的現在式：me、te、se、nos、os、se 要放在動詞前面。")] : []),
    h("h2", { class: "g-title v-sub" }, "現在分詞"),
    h("div", { class: "vtable" }, gerRow(v)),
    // 不能把 null 直接放進 append（DOM 會把它變成字串 "null"），所以用展開的陣列
    ...(gnote ? [
      h("p", { class: "note", lang: "zh-Hant" }, "進行式裡，me、te、se… 可以放在 estar 前面，也可以接在分詞後面："),
      h("p", { class: "note", lang: "es" }, `${gnote.before}／${gnote.after}`),
    ] : []),
    ...exampleBlocks(v),
    h("p", { class: "note", lang: "zh-Hant" }, "有底色和底線的字母，是跟一般規則不一樣的地方。"),
    h("p", { class: "muted small v-src", lang: "zh-Hant" }, "中文釋義與組別說明是 AI 寫的，還沒人審過。"),
  );
}
