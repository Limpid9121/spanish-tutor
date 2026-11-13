import { h, toast, TOAST_LONG_MS } from "../ui.js";
import { buildToday, gradeStep } from "../session.js";
import { GRADES, dayKey } from "../srs.js";
import { checkTyped, makeChoices, suggestGrade, answerModeOf, accentSegments, inQuiz } from "../practice.js";
import { openReport } from "./report.js";
import { speakBtn, spanishWord, chineseFront, posLine, meaningBlock, exampleBlocks } from "./card.js";
import { typeForm as makeTypeForm, typingController } from "./typing.js";

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
  const mode = answerModeOf(settings); // 作答方式（第 1.3 批）：看中文打字／翻面，看西文選擇題／翻面
  let turn = {}; // 目前這張卡的作答狀態：{ choices, answer }。評分成功換下一張時清空
  let curKind = "flip"; // 目前這張卡的作答種類：type／choice／flip（鍵盤捷徑要看）
  let typeInput = null;

  const wrap = h("div", { class: "review" });
  root.append(wrap);
  const typing = typingController(wrap);

  // 打字時鍵盤會蓋住畫面下半部：讓外框跟著 visualViewport（鍵盤彈出後真正看得到的區域），輸入框與按鍵就不會被蓋住（共用零件在 typing.js）
  const setTyping = (on) => typing.set(on);

  function finish() {
    setTyping(false);
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
    let kind = rev ? (mode.r === "type" ? "type" : "flip") : (mode.f === "choice" ? "choice" : "flip");
    if (!inQuiz(w)) kind = "flip"; // 網路用語先不入題（他 2026-11-11 的決定）
    if (kind === "choice") {
      turn.choices ??= makeChoices(w, vocab, Math.random, { familiarOverride: settings.familiarOverride });
      if (turn.choices.length < 2) kind = "flip"; // 詞表湊不出選項（正常不會發生）：退回翻面
    }
    curKind = kind;
    typeInput = null;
    const front = rev
      ? [posLine(w), chineseFront(w)]
      : [posLine(w), h("div", { class: "rv-head" }, spanishWord(w), speakBtn(w.es))];
    const back = h("div", { class: "answer" },
      kind === "type" && turn.answer ? verdictBlock(turn.answer) : null,
      rev ? h("div", { class: "rv-head" }, spanishWord(w), speakBtn(w.es)) : meaningBlock(w),
      rev ? h("div", { style: "margin-top:12px" }, meaningBlock(w)) : null,
      exampleBlocks(w),
      // 回報鍵：放在例句下方靠右（他 2026-11-11 選 A：原本在頂排的灰色小字他找不到），離底下的評分鍵遠，不會誤按
      h("div", { class: "report-row" }, h("button", {
        class: `report${reported.has(item.id) ? " sent" : ""}`, type: "button", "aria-label": "回報這張卡有問題",
        onclick: (e) => { e.stopPropagation(); openReport({ store, word: w, item, onSaved: () => { reported.add(item.id); draw(); } }); },
      }, reported.has(item.id) ? "已回報" : "回報問題")));

    // 建議評分只是標記：評分永遠由他按的那一個決定
    const sug = flipped && turn.answer ? suggestGrade(turn.answer.result) : null;
    const actions = flipped
      ? h("div", { class: "grades" }, GRADES.map((g) => h("button", {
        class: `grade${sug === g.value ? " suggested" : ""}`, type: "button", "data-g": g.value,
        "aria-label": sug === g.value ? `${g.label}（建議）` : false,
        onclick: () => grade(g.value),
      }, g.label, sug === g.value ? h("small", { class: "sug" }, "建議") : null)))
      : kind === "type" ? typeForm(w)
      : kind === "choice" ? h("button", { class: "ghost block dont-know", type: "button", onclick: dontKnow }, "不知道") // 不會就按這個，不必亂猜（猜對會被建議「記得」）
      : h("button", { class: "btn primary block", type: "button", onclick: flip }, "顯示答案");

    setTyping(kind === "type" && !flipped);
    wrap.replaceChildren(
      h("div", { class: "rv-top" },
        h("a", { class: "ghost", href: "#/today", style: "display:inline-flex;align-items:center" }, "結束"),
        h("span", { class: "prog" }, `剩 ${queue.length}`)),
      h("div", { class: "rv-card", onclick: kind === "flip" ? () => { if (!flipped) flip(); } : null },
        front, kind === "choice" ? choiceList() : null, flipped ? back : null),
      h("div", { class: "rv-actions" }, actions));
    if (typeInput) typeInput.focus({ preventScroll: true }); // iOS 沒有點擊動作時不一定會彈鍵盤，點一下輸入框即可
  }

  function flip() { flipped = true; draw(); }

  // ---- 看中文、打西文 ----
  function typeForm(w) {
    const tf = makeTypeForm({ onSubmit: (value) => submitTyped(w, value) });
    typeInput = tf.input;
    return tf.form;
  }

  function submitTyped(w, value) {
    if (flipped) return;
    const res = checkTyped(value, w); // 空白送出＝不知道，會是 wrong
    turn.answer = { kind: "type", typed: value.trim(), ...res };
    document.activeElement?.blur?.(); // 收起鍵盤
    flipped = true;
    draw();
  }

  function verdictBlock(a) {
    const expected = h("span", { lang: "es" }, accentSegments(a.expected).map((sg) => (sg.mark ? h("mark", { class: "acc" }, sg.text) : sg.text)));
    if (a.result === "exact") return h("div", { class: "verdict ok" }, h("p", { class: "v-title" }, "對了"));
    if (a.result === "accent") {
      return h("div", { class: "verdict" },
        h("p", { class: "v-title" }, "只差重音"),
        h("p", { class: "v-line" }, "正確拼法：", expected),
        h("p", { class: "v-line" }, "你打的：", h("span", { lang: "es" }, a.typed)));
    }
    return h("div", { class: "verdict bad" },
      h("p", { class: "v-title" }, "不對"),
      h("p", { class: "v-line" }, "你打的：", a.typed ? h("span", { lang: "es" }, a.typed) : "（沒有作答）"),
      h("p", { class: "v-line" }, "正確答案：", expected));
  }

  // ---- 看西文、選中文 ----
  function choiceList() {
    return h("div", { class: `choices${flipped ? " answered" : ""}`, role: "group", "aria-label": "選一個中文意思" },
      turn.choices.map((c, i) => {
        const picked = turn.answer?.index === i;
        const cls = flipped ? (c.correct ? " ok" : picked ? " bad" : "") : "";
        return h("button", { class: `choice${cls}`, type: "button", disabled: flipped, lang: "zh-Hant", onclick: () => pickChoice(i) },
          h("span", {}, c.text),
          flipped && c.correct ? h("span", { class: "mk", "aria-label": "正解" }, "✓") : flipped && picked ? h("span", { class: "mk", "aria-label": "你選的" }, "✗") : null);
      }));
  }

  function pickChoice(i) {
    if (flipped || !turn.choices?.[i]) return;
    turn.answer = { kind: "choice", index: i, result: turn.choices[i].correct ? "correct" : "incorrect" };
    flipped = true;
    draw();
  }

  function dontKnow() {
    if (flipped) return;
    turn.answer = { kind: "choice", index: -1, result: "incorrect" }; // 沒選任何一個：只標出正解，建議「忘了」
    flipped = true;
    draw();
  }

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
      turn = {};
      draw();
    } finally { busy = false; }
  }

  const onKey = (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || document.querySelector(".sheet-back")) return; // 打字、打備註時不能觸發評分
    if (!flipped && curKind === "flip" && (e.key === " " || e.key === "Enter")) { e.preventDefault(); if (queue.length) flip(); }
    else if (!flipped && curKind === "choice" && ["1", "2", "3", "4"].includes(e.key)) pickChoice(Number(e.key) - 1);
    else if (flipped && ["1", "2", "3", "4"].includes(e.key)) grade(Number(e.key));
  };
  document.addEventListener("keydown", onKey);

  draw();
  return () => { document.removeEventListener("keydown", onKey); setTyping(false); document.body.classList.remove("in-review"); };
}
