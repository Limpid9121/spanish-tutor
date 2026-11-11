import { h } from "../ui.js";
import { buildToday } from "../session.js";
import { dayKey } from "../srs.js";
import { cardState } from "../words.js";
import { shouldOfferSieve } from "../sieve.js";

export async function renderToday(root, ctx) {
  const { store, vocab } = ctx;
  const now = new Date();
  const [cards, settings, introduced] = await Promise.all([store.cards(), store.settings(), store.newCount(dayKey(now))]);
  if (shouldOfferSieve(settings, cards.size)) { location.replace("#/sieve"); return; } // 第一次使用：先快速篩字
  const t = buildToday({ vocab, cards, settings, now, introducedToday: introduced });
  const learned = vocab.filter((w) => cards.has(`${w.id}:f`)).length;
  const known = vocab.filter((w) => cardState(cards.get(`${w.id}:f`)) === "known").length;
  const total = t.queue.length;

  const line = total === 0
    ? h("p", { class: "today-line" }, "今天的字都複習完了。")
    : h("p", { class: "today-line" },
        t.due.length > 0 ? ["要複習 ", h("b", {}, t.due.length), " 張"] : null,
        t.due.length > 0 && t.fresh.length > 0 ? "，" : null,
        t.fresh.length > 0 ? [t.due.length > 0 ? "新字 " : "今天有新字 ", h("b", {}, t.fresh.length), " 個"] : null,
        "。");

  root.append(
    h("h1", { class: "title" }, "今日"),
    line,
    h("a", { class: `btn primary block${total === 0 ? " disabled" : ""}`, href: "#/review", "aria-disabled": total === 0 ? "true" : false }, "開始"),
    h("div", { class: "today-foot" },
      h("div", { class: "bar", role: "img", "aria-label": `已學 ${learned} 個，共 ${vocab.length} 個` }, h("i", { style: `width:${(learned / vocab.length) * 100}%` })),
      h("p", { class: "muted small" }, `已學 ${learned} ／ ${vocab.length}　　記熟 ${known}`)),
  );
}
