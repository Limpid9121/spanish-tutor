import { h, toast, TOAST_LONG_MS } from "../ui.js";
import { buildToday, gradeStep } from "../session.js";
import { GRADES, dayKey } from "../srs.js";
import { openReport } from "./report.js";
import { speakBtn, spanishWord, chineseFront, posLine, meaningBlock, exampleBlock } from "./card.js";

export async function renderReview(root, ctx) {
  const { store, vocab, byId } = ctx;
  document.body.classList.add("in-review");
  const settings = await store.settings();
  const cards = await store.cards();
  const t = buildToday({ vocab, cards, settings, now: new Date(), introducedToday: await store.newCount(dayKey()) });
  const queue = [...t.queue];
  let flipped = false;
  let reviewed = 0;
  const reported = new Set(); // 這一輪已經回報過的卡

  const wrap = h("div", { class: "review" });
  root.append(wrap);

  function finish() {
    wrap.replaceChildren(
      h("div", { class: "rv-top" }, h("span")),
      h("div", { class: "done" },
        h("p", {}, reviewed > 0 ? `這一輪完成了，複習 ${reviewed} 張。` : "今天沒有要複習的。"),
        h("a", { class: "btn primary block", href: "#/today" }, "回到今日")));
  }

  function draw() {
    if (!queue.length) return finish();
    const item = queue[0];
    const w = byId.get(item.wordId);
    const rev = item.dir === "r";
    const front = rev
      ? [posLine(w), chineseFront(w)]
      : [posLine(w), h("div", { class: "rv-head" }, spanishWord(w), speakBtn(w.es))];
    const back = h("div", { class: "answer" },
      rev ? h("div", { class: "rv-head" }, spanishWord(w), speakBtn(w.es)) : meaningBlock(w),
      rev ? h("div", { style: "margin-top:12px" }, meaningBlock(w)) : null,
      exampleBlock(w));

    const actions = flipped
      ? h("div", { class: "grades" }, GRADES.map((g) => h("button", { class: "grade", type: "button", "data-g": g.value, onclick: () => grade(g.value) }, g.label)))
      : h("button", { class: "btn primary block", type: "button", onclick: flip }, "顯示答案");

    wrap.replaceChildren(
      h("div", { class: "rv-top" },
        h("a", { class: "ghost", href: "#/today", style: "display:inline-flex;align-items:center" }, "結束"),
        // 回報鍵：翻面之後才出現，放在最上面一排，不跟底下的評分鍵搶位置
        flipped ? h("button", {
          class: `report${reported.has(item.id) ? " sent" : ""}`, type: "button", "aria-label": "回報這張卡有問題",
          onclick: () => openReport({ store, word: w, item, onSaved: () => { reported.add(item.id); draw(); } }),
        }, reported.has(item.id) ? "已回報" : "回報") : null,
        h("span", { class: "prog" }, `剩 ${queue.length}`)),
      h("div", { class: "rv-card", onclick: () => { if (!flipped) flip(); } }, front, flipped ? back : null),
      h("div", { class: "rv-actions" }, actions));
  }

  function flip() { flipped = true; draw(); }

  let busy = false;
  async function grade(g) {
    if (busy) return;
    busy = true;
    try {
      const r = await gradeStep({ store, cards, queue, grade: g, now: new Date() });
      if (!r.ok) { // 存檔失敗：畫面留在這張卡，告訴他（審核 B6：以前是按了沒反應、也沒提示）
        console.error(r.error);
        toast(r.message, TOAST_LONG_MS);
        return;
      }
      reviewed++;
      flipped = false;
      draw();
    } finally { busy = false; }
  }

  const onKey = (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || document.querySelector(".sheet-back")) return; // 打備註時不能觸發評分
    if (!flipped && (e.key === " " || e.key === "Enter")) { e.preventDefault(); if (queue.length) flip(); }
    else if (flipped && ["1", "2", "3", "4"].includes(e.key)) grade(Number(e.key));
  };
  document.addEventListener("keydown", onKey);

  draw();
  return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("in-review"); };
}
