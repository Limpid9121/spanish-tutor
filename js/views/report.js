// 「回報」面板：選原因（中文怪、例句怪、發音怪、其他）、可加一句備註，存進 IndexedDB。
import { h, toast } from "../ui.js";
import { REASONS, makeReport, NOTE_MAX } from "../reports.js";
import { trackVisualViewport } from "../viewport.js";

export function openReport({ store, word, item, onSaved }) {
  let reason = null;
  const back = h("div", { class: "sheet-back", onclick: (e) => { if (e.target === back) close(); } });
  const note = h("textarea", { placeholder: "想補充的話（選填）", maxlength: NOTE_MAX, "aria-label": "備註", rows: 3 });
  const send = h("button", { class: "btn primary", type: "button", disabled: true, onclick: save }, "送出");
  const btns = REASONS.map((r) => h("button", {
    type: "button", "aria-pressed": "false",
    onclick: () => { reason = r.key; btns.forEach((b, i) => b.setAttribute("aria-pressed", REASONS[i].key === reason ? "true" : "false")); send.disabled = false; },
  }, r.label));

  let untrack = () => {};
  function close() { untrack(); back.remove(); }
  async function save() {
    send.disabled = true;
    try {
      await store.addReport(makeReport({ word, cardId: item.id, reason, note: note.value }));
      close();
      toast("已回報，謝謝");
      onSaved?.();
    } catch (e) {
      console.error(e);
      send.disabled = false;
      toast("回報沒有存成功，請稍後再試");
    }
  }

  back.append(h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "回報這張卡" },
    h("h2", {}, "回報這張卡"),
    h("p", { class: "sub", lang: "es" }, word.es),
    h("div", { class: "reasons" }, btns),
    note,
    h("div", { class: "acts" }, h("button", { class: "btn", type: "button", onclick: close }, "取消"), send)));
  document.body.append(back);
  untrack = trackVisualViewport(back); // 鍵盤彈出時，面板跟著可見區域走，「送出」不會被蓋住
}
