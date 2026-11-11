import { h } from "../ui.js";
import { cardState, splitZh, spanishWithArticle, matchesQuery } from "../words.js";
import { isFamiliar } from "../session.js";
import { toast, TOAST_LONG_MS } from "../ui.js";
import { speakBtn, spanishWord, posLine, meaningBlock, exampleBlock } from "./card.js";

export async function renderVocab(root, ctx) {
  const { store, vocab } = ctx;
  const cards = await store.cards();
  const override = (await store.settings()).familiarOverride ?? {};
  const list = h("ul", { class: "list" });
  const search = h("input", { class: "search", type: "search", placeholder: "搜尋", "aria-label": "搜尋單字", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });

  const draw = () => {
    list.replaceChildren();
    const rows = vocab.filter((w) => matchesQuery(w, search.value)); // 不分重音：cancion 找得到 canción
    for (const w of rows) {
      const st = cardState(cards.get(`${w.id}:f`));
      list.append(h("li", {}, h("a", { href: `#/word/${encodeURIComponent(w.id)}` },
        h("span", { class: "es", lang: "es" }, spanishWithArticle(w)),
        h("span", { class: "zh", lang: "zh-Hant" }, splitZh(w.zh).main),
        isFamiliar(w, override) ? h("span", { class: "fam" }, "熟悉") : null,
        h("span", { class: `dot ${st === "new" ? "" : st}`, role: "img", "aria-label": st === "new" ? "未學" : st === "known" ? "記熟" : "學習中" }))));
    }
    if (!rows.length) list.append(h("li", { class: "empty" }, "找不到。"));
  };
  search.addEventListener("input", draw);
  root.append(h("h1", { class: "title" }, "單字"), search, list);
  draw();
}

export async function renderWord(root, ctx, id) {
  const w = ctx.byId.get(id);
  if (!w) { root.append(h("a", { class: "back", href: "#/vocab" }, "‹ 單字"), h("p", { class: "empty" }, "找不到這個字。")); return; }
  const rec = (await ctx.store.cards()).get(`${w.id}:f`);
  let familiar = isFamiliar(w, (await ctx.store.settings()).familiarOverride);
  const status = !rec ? "還沒學過" : `下次複習 ${new Date(rec.due).getMonth() + 1}/${new Date(rec.due).getDate()}`;
  const sw = h("button", { class: "switch", type: "button", role: "switch", "aria-label": "已熟悉", "aria-checked": familiar ? "true" : "false" });
  sw.addEventListener("click", async () => {
    const next = !familiar;
    sw.disabled = true;
    try {
      await ctx.store.setFamiliar(w.id, next); // 他的選擇存進設定（跟備份走），蓋過內容裡的預設
      familiar = next;
      sw.setAttribute("aria-checked", familiar ? "true" : "false");
    } catch (e) {
      console.error(e);
      toast("沒有存到，請稍後再試", TOAST_LONG_MS);
    } finally { sw.disabled = false; }
  });
  root.append(
    h("a", { class: "back", href: "#/vocab" }, "‹ 單字"),
    posLine(w),
    h("div", { class: "rv-head" }, spanishWord(w), speakBtn(w.es)),
    h("div", { class: "answer" }, meaningBlock(w), exampleBlock(w)),
    h("div", { class: "row fam-row" }, h("div", { class: "label" }, "已熟悉", h("small", {}, "打開後不再出現在新字和複習裡")), sw),
    h("p", { class: "muted small", style: "margin-top:32px" }, status),
  );
}
