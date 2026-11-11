// 回報面板打字時，iOS 的鍵盤會蓋住畫面下半部（layout viewport 不會縮），「送出」就被擋住。
// 解法：讓面板的外框跟著 visualViewport（鍵盤彈出後真正看得到的區域）走。

// 算外框要放哪：top、height 都是 px。沒有 visualViewport 就回 null（維持原本整個視窗）。
export function fitBox(vv) {
  if (!vv || !(vv.height > 0)) return null;
  return { top: Math.max(0, Math.round(vv.offsetTop ?? 0)), height: Math.round(vv.height) };
}

// 讓 el（position: fixed 的外框）一直貼著可見區域；回傳清除函式。
export function trackVisualViewport(el, vv = globalThis.visualViewport) {
  if (!vv) return () => {};
  const apply = () => {
    const b = fitBox(vv);
    if (!b) return;
    el.style.top = `${b.top}px`;
    el.style.height = `${b.height}px`;
    el.style.bottom = "auto";
  };
  vv.addEventListener("resize", apply);
  vv.addEventListener("scroll", apply);
  apply();
  return () => { vv.removeEventListener("resize", apply); vv.removeEventListener("scroll", apply); };
}
