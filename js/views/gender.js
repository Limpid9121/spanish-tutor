// 陰陽性陷阱專區（第 1.4 批）：#/gender 依組別列字，#/gender-drill 是「el 還是 la？」二選一練習。
import { h, toast, TOAST_LONG_MS } from "../ui.js";
import { loadGenderTraps } from "../data.js";
import { promptText } from "../practice.js";
import { lenClass } from "../words.js";
import { correctArticle, judgeAnswer, pickDrill, hasEarly, gradeGender, scoreText } from "../gender.js";
import { speakBtn } from "./card.js";

export async function renderGender(root, ctx) {
  const { groups, words } = await loadGenderTraps();
  root.append(
    h("a", { class: "back", href: "#/vocab" }, "‹ 單字"),
    h("h1", { class: "title" }, "陰陽性陷阱"),
    h("a", { class: "btn primary block", href: "#/gender-drill" }, "el 還是 la？練習"),
  );
  for (const g of groups) {
    const rows = words.filter((w) => w.group === g.id);
    if (!rows.length) continue;
    root.append(h("section", { class: "g-group" },
      h("h2", { class: "g-title" }, g.title),
      h("p", { class: "g-rule", lang: "zh-Hant" }, g.rule),
      h("ul", { class: "list" }, rows.map((w) => {
        const a = correctArticle(w); // 陰性但單數用 el 的字，這裡顯示的是 el
        return h("li", {}, h("div", { class: "g-row" },
          h("span", { class: `gart ${a}`, lang: "es" }, a),
          h("span", { class: "es", lang: "es" }, w.es),
          h("span", { class: "zh", lang: "zh-Hant" }, promptText(w))));
      }))));
  }
}

export async function renderGenderDrill(root, ctx) {
  const { store } = ctx;
  const { groups, words } = await loadGenderTraps();
  const cards = await store.cards();
  const box = h("div", { class: "gdrill" });
  root.append(h("a", { class: "back", href: "#/gender" }, "‹ 陰陽性陷阱"), box);

  let quiz = [];
  let idx = 0;
  let right = 0;
  let result = null; // 這一題答完的結果：{ choice, ...judgeAnswer }
  let busy = false;

  function start(early = false) {
    quiz = pickDrill({ traps: words, cards, now: new Date(), early });
    idx = 0;
    right = 0;
    result = null;
    draw();
  }

  function drawEmpty() {
    box.replaceChildren(
      h("div", { class: "done" },
        h("p", {}, "今天沒有要練的字了。"),
        hasEarly({ traps: words, cards, now: new Date() }) ? h("button", { class: "btn block", type: "button", onclick: () => start(true) }, "提早練習") : null,
        h("a", { class: "btn primary block", href: "#/gender" }, "回專區")));
  }

  function drawEnd() {
    box.replaceChildren(
      h("div", { class: "done" },
        h("p", {}, scoreText(right, quiz.length)),
        h("button", { class: "btn primary block", type: "button", onclick: () => start() }, "再一輪"),
        h("a", { class: "btn block", href: "#/gender" }, "回專區")));
  }

  function draw() {
    if (!quiz.length) return drawEmpty();
    if (idx >= quiz.length) return drawEnd();
    const t = quiz[idx];
    const btn = (art) => {
      const cls = result ? (art === result.answer ? " ok" : art === result.choice ? " bad" : "") : "";
      return h("button", { class: `art-btn${cls}`, type: "button", lang: "es", disabled: !!result, onclick: () => pick(art) }, art);
    };
    box.replaceChildren(
      h("p", { class: "prog g-prog" }, `第 ${idx + 1} ／ ${quiz.length} 題`),
      h("div", { class: "rv-head g-head" }, h("h1", { class: `word ${lenClass(t.es)}`, lang: "es" }, t.es), speakBtn(t.es)),
      h("p", { class: "meaning", lang: "zh-Hant" }, promptText(t)),
      h("div", { class: "art-btns", role: "group", "aria-label": "選 el 或 la" }, btn("el"), btn("la")),
      // 不能直接放 null：replaceChildren 會把 null 變成字串 "null"（作答前畫面曾出現 nullnull）
      ...(result ? [
        h("div", { class: `verdict ${result.correct ? "ok" : "bad"}` },
          h("p", { class: "v-title" }, result.headline),
          result.notes.map((n) => h("p", { class: "v-line", lang: "zh-Hant" }, n))),
        h("button", { class: "btn primary block g-next", type: "button", onclick: next }, idx + 1 >= quiz.length ? "看結果" : "下一個"),
      ] : []));
  }

  async function pick(choice) {
    if (result || busy) return;
    const t = quiz[idx];
    const r = judgeAnswer(t, choice, groups);
    busy = true;
    try {
      await gradeGender({ store, cards, trap: t, correct: r.correct, now: new Date() }); // 答對＝3、答錯＝1
    } catch (e) {
      console.error(e);
      toast("這一題沒有存到，請再按一次。如果一直這樣，先到設定匯出備份。", TOAST_LONG_MS);
      return;
    } finally { busy = false; }
    if (r.correct) right++;
    result = { choice, ...r };
    draw();
  }

  function next() {
    if (!result) return;
    idx++;
    result = null;
    draw();
  }

  // 答完之後點畫面空白處也能繼續（按鈕、喇叭除外）
  const onClick = (e) => { if (result && idx < quiz.length && !e.target.closest("button, a")) next(); };
  const onKey = (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || document.querySelector(".sheet-back")) return;
    if (!result && quiz[idx] && e.key === "1") pick("el");
    else if (!result && quiz[idx] && e.key === "2") pick("la");
    else if (result && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); next(); }
  };
  box.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  start();
  return () => document.removeEventListener("keydown", onKey);
}
