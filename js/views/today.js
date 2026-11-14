import { h } from "../ui.js";
import { buildToday, wordCards } from "../session.js";
import { dayKey } from "../srs.js";
import { cardState } from "../words.js";
import { shouldOfferSieve } from "../sieve.js";
import { loadVerbs } from "../data.js";
import { verbDueCount } from "../verbDrill.js";
import { loadGrammar } from "../data.js";
import { grammarDueCount } from "../grammar.js";

export async function renderToday(root, ctx) {
  const { store, vocab } = ctx;
  const now = new Date();
  const [cards, settings, introduced] = await Promise.all([store.cards(), store.settings(), store.newCount(dayKey(now))]);
  if (shouldOfferSieve(settings, wordCards(cards).length)) { location.replace("#/sieve"); return; } // 第一次使用：先快速篩字
  const t = buildToday({ vocab, cards, settings, now, introducedToday: introduced });
  const learned = vocab.filter((w) => cards.has(`${w.id}:f`)).length;
  const known = vocab.filter((w) => cardState(cards.get(`${w.id}:f`)) === "known").length;
  const total = t.queue.length;
  let verbDue = null; // 動詞練習到期幾張；動詞資料讀不到就不顯示這一行（不影響單字複習）
  try { verbDue = verbDueCount(cards, (await loadVerbs()).verbs, now); } catch (e) { console.error(e); }

  let grammarDue = null; // 文法複習到期幾題；文法資料讀不到就不顯示這一行（不影響單字與動詞）
  try { const g = await loadGrammar(); grammarDue = grammarDueCount({ units: g.units, unitData: g.unitData, cards, settings, now }); } catch (e) { console.error(e); }

  const line = total === 0
    ? h("p", { class: "today-line" }, "今天的字都複習完了。")
    : h("p", { class: "today-line" },
        t.due.length > 0 ? ["要複習 ", h("b", {}, t.due.length), " 張"] : null,
        t.due.length > 0 && t.fresh.length > 0 ? "，" : null,
        t.fresh.length > 0 ? [t.due.length > 0 ? "新卡 " : "今天有新卡 ", h("b", {}, t.fresh.length), " 張"] : null, // 新卡含反向卡（1.3 審核建議：不是全都是新字）
        "。");

  root.append(
    h("h1", { class: "title" }, "今日"),
    line,
    h("a", { class: `btn primary block${total === 0 ? " disabled" : ""}`, href: "#/review", "aria-disabled": total === 0 ? "true" : false }, "開始"),
    // 不能把 null 交給 append（DOM 會把它變成字串 "null"），所以用展開的陣列
    ...(verbDue === null ? [] : [h("a", { class: "gender-entry verb-entry", href: "#/verb-drill" },
      h("span", {}, "動詞：到期 ", h("b", {}, verbDue), " 張"), h("span", { class: "chev", "aria-hidden": "true" }, "›"))]),
    ...(grammarDue === null ? [] : [h("a", { class: "gender-entry verb-entry", href: "#/grammar-review" },
      h("span", {}, "文法：到期 ", h("b", {}, grammarDue), " 題"), h("span", { class: "chev", "aria-hidden": "true" }, "›"))]),
    h("div", { class: "today-foot" },
      h("div", { class: "bar", role: "img", "aria-label": `已學 ${learned} 個，共 ${vocab.length} 個` }, h("i", { style: `width:${(learned / vocab.length) * 100}%` })),
      h("p", { class: "muted small" }, `已學 ${learned} ／ ${vocab.length}　　記熟 ${known}`)),
  );
}
