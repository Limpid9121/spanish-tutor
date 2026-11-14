// 文法題的畫面零件（第 3a 批）：一題的題面（choice／fill／order）與作答後的結果。學單元與複習到期題共用。
// turn：目前這一題的狀態 { options, shuffled, picked: [token 索引], answer: { result, typed?, picked? } }，由呼叫端保管，換題時清空。
import { h } from "../ui.js";
import { fillSentence, gradeChoice, gradeFill, gradeOrder, shuffleOptions, shuffleTokens } from "../grammar.js";
import { speakBtn } from "./card.js";
import { typeForm as makeTypeForm } from "./typing.js";

const TYPE_LABEL = { choice: "選一個", fill: "打出空格的字", order: "把字排成句子" };

// 西文句子，空格畫成一條底線
function sentenceLine(drill) {
  const parts = drill.es.split("___");
  return h("p", { class: "gd-sentence", lang: "es" }, parts[0], h("span", { class: "gd-blank", "aria-label": "空格" }, "  "), parts[1] ?? "");
}

const RESULT_TITLE = { exact: "對了", correct: "對了", accent: "只差重音", wrong: "不對", incorrect: "不對" };

// 作答後的結果區：對／不對／只差重音、正確答案、完整句子（可念）、中文、why
export function resultBlock(drill, answer) {
  const r = answer.result;
  const good = r === "exact" || r === "correct";
  const lines = [];
  if (drill.type === "fill" && !good) {
    lines.push(h("p", { class: "v-line" }, "你打的：", answer.typed ? h("span", { lang: "es" }, answer.typed) : "（沒有作答）"));
    lines.push(h("p", { class: "v-line" }, "正確答案：", h("span", { lang: "es" }, answer.expected)));
  } else if (drill.type === "order" && !good) {
    lines.push(h("p", { class: "v-line" }, "你排的：", h("span", { lang: "es" }, (answer.picked ?? []).join(" ") || "（沒有作答）")));
  } else if (drill.type === "choice" && !good) {
    lines.push(h("p", { class: "v-line" }, "正確答案：", h("span", { lang: "es" }, drill.answer)));
  }
  const sentence = fillSentence(drill);
  return h("div", { class: "gd-result" },
    h("div", { class: `verdict${good ? " ok" : r === "accent" ? "" : " bad"}` },
      h("p", { class: "v-title" }, RESULT_TITLE[r]), lines),
    h("div", { class: "example gd-full" },
      h("div", {}, h("p", { class: "es", lang: "es" }, sentence), h("p", { class: "zh", lang: "zh-Hant" }, drill.zh)),
      speakBtn(sentence, "播放整句")),
    h("p", { class: "gd-why", lang: "zh-Hant" }, drill.why));
}

// 題面。回傳 { front（卡片區的節點）, actions（底部操作區的節點，作答後為 null）, input（打字題的輸入框）}。
// handlers：{ onAnswer(answerObject)，作答完成時呼叫；redraw() 重畫 }
export function questionView(drill, turn, { onAnswer, redraw, rng = Math.random }) {
  const answered = !!turn.answer;
  const head = [h("p", { class: "pos" }, TYPE_LABEL[drill.type])];
  if (drill.type === "choice") {
    turn.options ??= shuffleOptions(drill.options, rng);
    const list = h("div", { class: `choices${answered ? " answered" : ""}`, role: "group", "aria-label": "選一個答案" },
      turn.options.map((o) => {
        const picked = turn.answer?.picked === o;
        const cls = answered ? (o === drill.answer ? " ok" : picked ? " bad" : "") : "";
        return h("button", {
          class: `choice gd-opt${cls}`, type: "button", disabled: answered, lang: "es",
          onclick: () => { if (!turn.answer) onAnswer({ result: gradeChoice(drill, o), picked: o }); },
        }, h("span", {}, o),
        answered && o === drill.answer ? h("span", { class: "mk", "aria-label": "正解" }, "✓") : answered && picked ? h("span", { class: "mk", "aria-label": "你選的" }, "✗") : null);
      }));
    return { front: [...head, sentenceLine(drill), list], actions: null };
  }
  if (drill.type === "fill") {
    const front = [...head, sentenceLine(drill), ...(drill.hint ? [h("p", { class: "note gd-hint", lang: "zh-Hant" }, `提示：${drill.hint}`)] : [])];
    if (answered) return { front, actions: null };
    const tf = makeTypeForm({ onSubmit: (value) => onAnswer(gradeFill(drill, value)) });
    return { front, actions: tf.form, input: tf.input };
  }
  // order
  turn.shuffled ??= shuffleTokens(drill.tokens, rng);
  turn.picked ??= [];
  const good = answered && (turn.answer.result === "correct" || turn.answer.result === "exact");
  const pickedSet = new Set(turn.picked);
  const line = h("div", { class: "gd-line", lang: "es", "aria-label": "你排好的句子" },
    turn.picked.length ? turn.picked.map((i) => h("button", {
      class: `ord-tok on${answered ? (good ? " ok" : " bad") : ""}`, type: "button", disabled: answered, onclick: () => { turn.picked = turn.picked.filter((x) => x !== i); redraw(); },
    }, turn.shuffled[i])) : h("span", { class: "gd-line-empty", lang: "zh-Hant" }, "點下面的字，依序排進來"));
  const pool = h("div", { class: "gd-pool", lang: "es", role: "group", "aria-label": "可以選的字" },
    turn.shuffled.map((t, i) => h("button", {
      class: `ord-tok${pickedSet.has(i) ? " used" : ""}`, type: "button", disabled: answered || pickedSet.has(i),
      onclick: () => { turn.picked.push(i); redraw(); },
    }, t)));
  if (answered) return { front: [...head, line], actions: null }; // 作答後字塊區收起來，畫面留給結果
  const front = [...head, line, pool];
  const full = turn.picked.length === drill.tokens.length;
  const actions = h("div", { class: "gd-ord-actions" },
    h("button", { class: "btn", type: "button", disabled: turn.picked.length === 0, onclick: () => { turn.picked = []; redraw(); } }, "清除"),
    h("button", {
      class: "btn primary", type: "button", disabled: !full,
      onclick: () => { const picked = turn.picked.map((i) => turn.shuffled[i]); onAnswer({ result: gradeOrder(drill, picked), picked }); },
    }, "送出"));
  return { front, actions };
}
