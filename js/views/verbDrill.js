// 動詞變化練習（第 2b 批）：#/verb-drill。出「人稱＋原形」或「現在分詞」，他打變化形。
// 評分仍由他按四個鍵，App 只標建議；錯的時候把他打的和正解逐字母對齊、標出錯的字，翻面後顯示整張人稱表並標出答錯那格。
import { h, toast, TOAST_LONG_MS } from "../ui.js";
import { loadVerbs } from "../data.js";
import { gradeStep } from "../session.js";
import { GRADES } from "../srs.js";
import { suggestGrade } from "../practice.js";
import { lenClass } from "../words.js";
import { buildVerbToday, makeQuestion, gradeVerbAnswer, verbDayKey } from "../verbDrill.js";
import { presRows, gerRow } from "./verbs.js";
import { typeForm as makeTypeForm, typingController } from "./typing.js";

// 對齊顯示：兩排字母上下對齊，錯的欄標色；漏打的欄在「你打的」那排顯示 –，多打的欄在「正確」那排顯示 –
export function alignBlock(res) {
  const cell = (ch, c, side) => h("span", { class: `ac${c.ok ? "" : side === "t" ? " x err" : " x miss"}` }, ch ?? "–");
  const row = (label, side) => h("div", { class: "al-row" },
    h("span", { class: "al-l", lang: "zh-Hant" }, label),
    h("span", { class: "al-cells", "aria-hidden": "true" }, res.align.map((c) => cell(side === "t" ? c.t : c.e, c, side))));
  return h("div", { class: "align", lang: "es", role: "img", "aria-label": `你打的 ${res.typedForm}，正確是 ${res.expected}` },
    row("你打的", "t"), row("正確", "e"));
}

export function verdictBlock(res) {
  if (res.result === "exact") return h("div", { class: "verdict ok" }, h("p", { class: "v-title" }, "對了"));
  const accent = res.result === "accent";
  return h("div", { class: `verdict${accent ? "" : " bad"}` },
    h("p", { class: "v-title" }, accent ? "只差重音" : "不對"),
    res.typedForm ? null : h("p", { class: "v-line" }, "（沒有作答）"),
    h("p", { class: "v-line" }, "正確答案：", h("span", { lang: "es" }, res.expectedDisplay)),
    res.typedForm ? alignBlock(res) : null);
}

export async function renderVerbDrill(root, ctx) {
  const { store } = ctx;
  document.body.classList.add("in-review");
  const [settings, cards, introduced, data] = await Promise.all([
    store.settings(), store.cards(), store.newCount(verbDayKey(new Date())), loadVerbs(),
  ]);
  const t = buildVerbToday({ verbs: data.verbs, cards, settings, now: new Date(), introducedToday: introduced });
  const queue = [...t.queue];
  let flipped = false;
  let reviewed = 0;
  let turn = {}; // 目前這張卡：{ q（題目）, answer（作答結果） }。評分成功換下一張時清空
  let typeInput = null;

  const wrap = h("div", { class: "review" });
  root.append(wrap);
  const typing = typingController(wrap);

  function finish() {
    typing.set(false);
    wrap.replaceChildren(
      h("div", { class: "rv-top" }, h("span")),
      h("div", { class: "done" },
        h("p", {}, reviewed > 0 ? `這一輪完成了，練了 ${reviewed} 張。` : "今天沒有要練的動詞。"),
        h("a", { class: "btn primary block", href: "#/today" }, "回到今日")));
  }

  function draw() {
    while (queue.length && !data.byId.has(queue[0].wordId)) queue.shift(); // 資料裡已經沒有的動詞（舊備份）不出
    if (!queue.length) return finish();
    const item = queue[0];
    const verb = data.byId.get(item.wordId);
    const q = (turn.q ??= makeQuestion(verb, item.tense, Math.random, { vosotros: settings.verbVosotros === true }));
    typeInput = null;
    const promptText = q.tense === "ger" ? `${q.promptEs} → ？` : q.promptEs;
    const front = [
      h("p", { class: "pos" }, q.label),
      h("div", { class: "rv-head" }, h("h1", { class: `word ${lenClass(promptText)}`, lang: "es" }, promptText)),
      h("p", { class: "meaning vd-zh", lang: "zh-Hant" }, q.promptZh),
      ...(q.hint ? [h("p", { class: "note vd-hint", lang: "zh-Hant" }, q.hint)] : []),
    ];
    const res = turn.answer;
    const asked = res ? { tense: q.tense, person: q.person, bad: res.result === "wrong" } : null;
    const back = h("div", { class: "answer" },
      res ? verdictBlock(res) : null,
      h("div", { class: "vtable vd-table" }, presRows(verb, asked), gerRow(verb, asked)));

    const sug = flipped && res ? suggestGrade(res.result) : null;
    const actions = flipped
      ? h("div", { class: "grades" }, GRADES.map((g) => h("button", {
        class: `grade${sug === g.value ? " suggested" : ""}`, type: "button", "data-g": g.value,
        "aria-label": sug === g.value ? `${g.label}（建議）` : false,
        onclick: () => grade(g.value),
      }, g.label, sug === g.value ? h("small", { class: "sug" }, "建議") : null)))
      : typeForm(verb, q);

    typing.set(!flipped);
    wrap.replaceChildren(
      h("div", { class: "rv-top" },
        h("a", { class: "ghost", href: "#/today", style: "display:inline-flex;align-items:center" }, "結束"),
        h("span", { class: "prog" }, `剩 ${queue.length}`)),
      h("div", { class: "rv-card" }, front, flipped ? back : null),
      h("div", { class: "rv-actions" }, actions));
    if (typeInput) typeInput.focus({ preventScroll: true });
  }

  function typeForm(verb, q) {
    const tf = makeTypeForm({ onSubmit: (value) => submitTyped(verb, q, value) });
    typeInput = tf.input;
    return tf.form;
  }

  function submitTyped(verb, q, value) {
    if (flipped) return;
    turn.answer = gradeVerbAnswer(value, verb, q); // 空白送出＝不知道，會是 wrong
    document.activeElement?.blur?.(); // 收起鍵盤
    flipped = true;
    draw();
  }

  let busy = false;
  async function grade(g) {
    if (busy) return;
    busy = true;
    try {
      const r = await gradeStep({ store, cards, queue, grade: g, now: new Date() });
      if (!r.ok) {
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
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return; // 打字時不能觸發評分
    if (flipped && ["1", "2", "3", "4"].includes(e.key)) grade(Number(e.key));
  };
  document.addEventListener("keydown", onKey);

  draw();
  return () => { document.removeEventListener("keydown", onKey); typing.set(false); document.body.classList.remove("in-review"); };
}
