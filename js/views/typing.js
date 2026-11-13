// 打字作答的共用零件（第 2b 批從 review.js 抽出）：西文輸入框＋ á é í ó ú ñ ü 鍵，以及「鍵盤彈出時外框跟著可見區域」。
// 單字複習（review.js）與動詞變化練習（verbDrill.js）共用；行為跟抽出之前一樣。
import { h } from "../ui.js";
import { trackVisualViewport } from "../viewport.js";

export const ACCENT_KEYS = ["á", "é", "í", "ó", "ú", "ñ", "ü"];

// 輸入框加重音鍵加送出鈕。onSubmit(value) 在按送出或 Enter 時呼叫。回傳 { form, input }。
export function typeForm({ onSubmit, label = "用西文作答", placeholder = "輸入西文", submitText = "送出" }) {
  const input = h("input", {
    class: "type-input", type: "text", lang: "es", autocapitalize: "off", autocorrect: "off", autocomplete: "off",
    spellcheck: "false", enterkeyhint: "done", "aria-label": label, placeholder,
  });
  const insert = (ch) => {
    const a = input.selectionStart ?? input.value.length;
    const b = input.selectionEnd ?? a;
    input.setRangeText(ch, a, b, "end");
    input.focus({ preventScroll: true });
  };
  const form = h("form", { class: "type-form", onsubmit: (e) => { e.preventDefault(); onSubmit(input.value); } },
    input,
    h("div", { class: "accent-keys" }, ACCENT_KEYS.map((ch) => h("button", {
      type: "button", "aria-label": `插入 ${ch}`,
      onmousedown: (e) => e.preventDefault(), // 按下去不讓輸入框失去焦點，鍵盤才不會收起來
      onclick: () => insert(ch),
    }, ch))),
    h("button", { class: "btn primary block", type: "submit" }, submitText));
  return { form, input };
}

// 打字時鍵盤會蓋住畫面下半部：讓外框（wrap）跟著 visualViewport，輸入框與按鍵就不會被蓋住。set(true／false) 開關。
export function typingController(wrap) {
  let untrack = null;
  return {
    set(on) {
      wrap.classList.toggle("typing", on);
      if (on && !untrack) untrack = trackVisualViewport(wrap);
      if (!on && untrack) {
        untrack();
        untrack = null;
        for (const p of ["top", "height", "bottom"]) wrap.style.removeProperty(p);
      }
    },
  };
}
