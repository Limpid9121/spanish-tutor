// 快速篩字畫面：一次一個字，固定兩鍵「會」「不會」，也可以左右滑（右＝會、左＝不會）。可以隨時離開，下次接著篩。
import { h, toast, TOAST_LONG_MS } from "../ui.js";
import { sieveNext, sieveProgress, sieveStatus, answerSieve, skipSieve, finishSieve, restartSieve, sievePrev, sieveIndex } from "../sieve.js";
import { speakBtn, spanishWord, posLine } from "./card.js";
import { askSheet } from "./sheet.js";

const SWIPE_PX = 70;
const HINT_CARDS = 3; // 操作提示只在前幾張顯示，之後不佔版面（窄螢幕會擠出孤字）

export async function renderSieve(root, ctx) {
  const { store, vocab } = ctx;
  document.body.classList.add("in-review");
  let settings = await store.settings();
  const cards = await store.cards();
  if (!settings.sieve) { // 第一次進來就先記下「開始過了」：中途離開後，今日頁不會再一直把他拉回來
    settings = await store.updateSettings(() => ({ sieve: { status: "active", seen: {} } }));
  } else if (["skipped", "done"].includes(sieveStatus(settings) ?? "")) { // 從設定頁重跑
    const { sieve } = await restartSieve(store);
    settings = { ...settings, sieve };
  }
  const wrap = h("div", { class: "review sieve" });
  root.append(wrap);
  let busy = false;
  let viewId = null; // 按了「上一個」之後正在重篩的字；null＝照順序問第一個沒問過的字

  async function leaveFinished() {
    try { await finishSieve(store); } catch (e) { console.error(e); }
    wrap.replaceChildren(
      h("div", { class: "rv-top" }, h("span")),
      h("div", { class: "done" },
        h("p", {}, "篩完了。標「會」的字不會再出現在新字裡。"),
        h("a", { class: "btn primary block", href: "#/today" }, "回到今日")));
  }

  function draw() {
    const nx = sieveNext(vocab, settings, cards);
    if (!nx && viewId === null) { leaveFinished(); return; }
    const word = viewId !== null ? vocab.find((w) => w.id === viewId) : nx.word;
    const pos = sieveIndex(vocab, settings, cards, word.id); // 一律用「排第幾」，重跑篩字後才不會跟「上一個」的算法對不起來（1.1c 複審建議 2）
    const prev = sievePrev(vocab, settings, cards, word.id);
    const n = { word };
    const card = h("div", { class: "sv-card" },
      posLine(n.word),
      h("div", { class: "rv-head" }, spanishWord(n.word), speakBtn(n.word.es)));
    wrap.replaceChildren(
      h("div", { class: "rv-top" },
        h("a", { class: "ghost", href: "#/settings", style: "display:inline-flex;align-items:center" }, "先離開"),
        h("span", { class: "prog" }, `${pos.index} ／ ${pos.total}`)),
      ...(prev ? [h("button", { class: "ghost sv-prev", type: "button", onclick: goPrev }, "← 上一個")] : []), // 不能直接放 null：replaceChildren 會把它變成字串 "null"
      h("div", { class: "sv-stage" }, card, pos.index <= HINT_CARDS ? h("p", { class: "sv-hint muted small" }, "看到就懂的按「會」。可左右滑：右＝會，左＝不會") : null),
      h("div", { class: "rv-actions" },
        h("div", { class: "sv-btns" },
          h("button", { class: "grade sv-no", type: "button", onclick: () => answer(n.word, false) }, "不會"),
          h("button", { class: "grade sv-yes", type: "button", onclick: () => answer(n.word, true) }, "會")),
        h("button", { class: "ghost sv-skip", type: "button", onclick: askSkip }, "全部跳過")));
    attachSwipe(card, n.word);
  }

  async function answer(word, knows) {
    if (busy) return;
    busy = true;
    try {
      const cur = await answerSieve(store, word.id, knows);
      settings = cur;
      viewId = null; // 重篩完回到第一個沒問過的字
      draw();
    } catch (e) {
      console.error(e);
      toast("這一題沒有存到。請完全關掉 App 再重新開啟。", TOAST_LONG_MS);
    } finally { busy = false; }
  }

  function goPrev() {
    if (busy) return;
    const shown = viewId ?? sieveNext(vocab, settings, cards)?.word.id ?? null;
    const p = sievePrev(vocab, settings, cards, shown);
    if (!p) return;
    viewId = p.id;
    draw();
  }

  async function askSkip() {
    const yes = await askSheet({ title: "跳過篩字？", sub: "之後想篩，可以到設定的「快速篩字」。", yes: "跳過", no: "繼續篩" });
    if (!yes) return;
    try { await skipSieve(store); location.hash = "#/today"; } catch (e) { console.error(e); toast("沒有存到，請稍後再試", TOAST_LONG_MS); }
  }

  function attachSwipe(card, word) {
    let x0 = null, dx = 0;
    card.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; x0 = e.clientX; dx = 0; card.style.transition = "none"; card.setPointerCapture?.(e.pointerId); });
    card.addEventListener("pointermove", (e) => {
      if (x0 === null) return;
      dx = e.clientX - x0;
      card.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
      card.dataset.dir = Math.abs(dx) > SWIPE_PX ? (dx > 0 ? "yes" : "no") : "";
    });
    const reset = () => { x0 = null; card.style.transition = ""; card.style.transform = ""; card.dataset.dir = ""; };
    const end = () => {
      if (x0 === null) return;
      const moved = dx;
      reset();
      if (Math.abs(moved) > SWIPE_PX) answer(word, moved > 0);
    };
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", reset); // 系統手勢中斷：只復位，不算作答
  }

  const onKey = (e) => {
    if (document.querySelector(".sheet-back")) return;
    const shown = viewId !== null ? vocab.find((w) => w.id === viewId) : sieveNext(vocab, settings, cards)?.word;
    if (!shown) return;
    if (e.key === "ArrowRight") answer(shown, true);
    else if (e.key === "ArrowLeft") answer(shown, false);
  };
  document.addEventListener("keydown", onKey);
  draw();
  return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("in-review"); };
}
