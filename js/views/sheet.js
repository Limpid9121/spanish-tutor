// 底部的二選一詢問面板（跟回報面板同一種樣式）。回傳 Promise<boolean>：按「是」＝true，按「否」或點背景＝false。
import { h } from "../ui.js";

export function askSheet({ title, sub, yes, no }) {
  return new Promise((resolve) => {
    const done = (v) => { back.remove(); resolve(v); };
    const back = h("div", { class: "sheet-back", onclick: (e) => { if (e.target === back) done(false); } },
      h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": title },
        h("h2", {}, title),
        sub ? h("p", { class: "sub" }, sub) : null,
        h("div", { class: "acts" },
          h("button", { class: "btn", type: "button", onclick: () => done(false) }, no),
          h("button", { class: "btn primary", type: "button", onclick: () => done(true) }, yes))));
    document.body.append(back);
  });
}

// 退回下載之後問：有存好嗎？（審核 A1：按「有存好」才記上次備份）
export const askBackupSaved = () => askSheet({
  title: "有存好嗎？",
  sub: "備份檔已下載。到「檔案」App 的「下載項目」看看有沒有。",
  yes: "有存好",
  no: "還沒",
});
