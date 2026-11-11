// 出處與授權：直接顯示 CREDITS.md（離線也讀得到，因為 service worker 有快取它）。
import { h } from "../ui.js";

function inline(text) {
  const out = [];
  const re = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(h("a", { href: m[2], target: "_blank", rel: "noopener" }, m[1]));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderMarkdown(md, { skipTitle = false } = {}) {
  const root = h("div", { class: "prose" });
  let ul = null;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const li = line.match(/^[-*]\s+(.*)/);
    if (li) { if (!ul) { ul = h("ul"); root.append(ul); } ul.append(h("li", {}, inline(li[1]))); continue; }
    ul = null;
    if (!line.trim()) continue;
    const hd = line.match(/^(#{1,3})\s+(.*)/);
    if (hd && skipTitle && hd[1].length === 1) continue;
    if (hd) root.append(h(hd[1].length === 1 ? "h2" : "h3", {}, hd[2]));
    else root.append(h("p", {}, inline(line)));
  }
  return root;
}

export async function renderCredits(root) {
  root.append(h("a", { class: "back", href: "#/settings" }, "‹ 設定"), h("h1", { class: "title" }, "出處與授權"));
  try {
    const res = await fetch("CREDITS.md");
    if (!res.ok) throw new Error(String(res.status));
    root.append(renderMarkdown(await res.text(), { skipTitle: true }));
  } catch {
    root.append(h("p", { class: "muted" }, "讀不到 CREDITS.md。"));
  }
}
