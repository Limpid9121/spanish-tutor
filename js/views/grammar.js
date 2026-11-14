// 文法分頁（第 3a 批）：#/grammar 單元地圖、#/unit/uNN 單元說明、#/unit-drill/uNN 學單元、#/grammar-review 複習到期題。
import { h, toast, TOAST_LONG_MS } from "../ui.js";
import { loadGrammar } from "../data.js";
import { GRADE_FAIL_MESSAGE, gradeStep } from "../session.js";
import { GRADES } from "../srs.js";
import { suggestGrade } from "../practice.js";
import { buildGrammarToday, finishLearning, grammarCardId, unitStatus } from "../grammar.js";
import { exampleBlocks, speakBtn } from "./card.js";
import { questionView, resultBlock } from "./grammarDrill.js";
import { typingController } from "./typing.js";

const STATUS_LABEL = { new: "新", started: "學習中", done: "完成", skipped: "我會了", later: "之後" };

async function loadOrShowError(root) {
  try { return await loadGrammar(); } catch (e) {
    console.error(e);
    root.append(h("a", { class: "back", href: "#/grammar" }, "‹ 文法"), h("p", { class: "empty" }, `文法資料讀不到：${e.message}`));
    return null;
  }
}

export async function renderGrammar(root, ctx) {
  const { store } = ctx;
  root.append(h("h1", { class: "title" }, "文法"));
  let g;
  try { g = await loadGrammar(); } catch (e) { // 文法資料讀不到：這個分頁顯示錯誤，不影響單字與動詞
    console.error(e);
    root.append(h("p", { class: "empty" }, `文法資料讀不到：${e.message}`));
    return;
  }
  const [cards, settings] = await Promise.all([store.cards(), store.settings()]);
  const now = new Date();
  const due = buildGrammarToday({ units: g.units, unitData: g.unitData, cards, settings, now }).due.length;
  root.append(h("p", { class: "note gm-intro", lang: "zh-Hant" }, "做完一個單元，題目會進入每天的複習。"));
  if (due > 0) {
    root.append(h("a", { class: "btn primary block gm-review", href: "#/grammar-review" }, `複習到期 ${due} 題`));
  }
  root.append(h("ol", { class: "gm-list" }, g.units.map((u, i) => {
    const st = unitStatus({ ...u, drills: g.unitData[u.id]?.drills }, cards, settings);
    const body = [
      h("span", { class: "gm-n" }, String(i + 1)),
      h("span", { class: "gm-t", lang: "zh-Hant" }, h("span", { class: "gm-title" }, u.title), h("small", {}, u.level)),
      h("span", { class: `gm-st st-${st}`, lang: "zh-Hant" }, STATUS_LABEL[st]),
    ];
    return h("li", {}, st === "later"
      ? h("div", { class: "gm-row later", "aria-disabled": "true" }, body)
      : h("a", { class: "gm-row", href: `#/unit/${u.id}` }, body));
  })));
}

// 說明表格：左欄西文（淡色標 vosotros）、右欄中文；第三欄有的話是可以按鍵念的單字
function tableBlock(rows) {
  return h("div", { class: "ut-table" }, rows.map(([left, right, words]) => h("div", { class: `ut-row${/^vosotros/.test(left) ? " dim" : ""}` },
    h("span", { class: "ut-l", lang: "es" }, left),
    h("span", { class: "ut-r", lang: "zh-Hant" }, right),
    words ? h("span", { class: "ut-words" }, words.map((w) => h("span", { class: "ut-word" }, h("span", { lang: "es" }, w), speakBtn(w, `播放 ${w} 的發音`)))) : null)));
}

export async function renderUnit(root, ctx, id) {
  const { store } = ctx;
  const g = await loadOrShowError(root);
  if (!g) return;
  const entry = g.unitById.get(id);
  const u = g.unitData[id];
  if (!entry || !u) { root.append(h("a", { class: "back", href: "#/grammar" }, "‹ 文法"), h("p", { class: "empty" }, "這個單元還沒有內容。")); return; }
  const [cards, settings] = await Promise.all([store.cards(), store.settings()]);
  let skipped = settings.unitSkip?.[id] === true;
  const status = unitStatus({ ...entry, drills: u.drills }, cards, { unitSkip: {} }); // 看卡片是不是都建好了，不看「我會了」
  const startBtn = h("a", { class: "btn primary block", href: `#/unit-drill/${id}` }, status === "done" ? "再練一次" : "開始練習");
  const skipBtn = h("button", { class: "btn block ut-skip", type: "button" }, skipped ? "加回學習" : "我會了，跳過");
  skipBtn.addEventListener("click", async () => {
    skipBtn.disabled = true;
    try {
      const next = await store.updateSettings((cur) => {
        const m = { ...(cur.unitSkip ?? {}) };
        if (m[id]) delete m[id]; else m[id] = true;
        return { unitSkip: m };
      });
      skipped = next.unitSkip?.[id] === true;
      skipBtn.textContent = skipped ? "加回學習" : "我會了，跳過";
      toast(skipped ? "已跳過，這個單元的題目不會出現在複習" : "已加回學習");
    } catch (e) {
      console.error(e);
      toast(GRADE_FAIL_MESSAGE, TOAST_LONG_MS);
    } finally { skipBtn.disabled = false; }
  });
  const m = u.mistake;
  root.append(
    h("a", { class: "back", href: "#/grammar" }, "‹ 文法"),
    h("p", { class: "pos" }, u.level),
    h("h1", { class: "title ut-title", lang: "zh-Hant" }, u.title),
    h("p", { class: "ut-rule", lang: "zh-Hant" }, u.rule),
    ...(u.table ? [tableBlock(u.table)] : []),
    h("h2", { class: "g-title v-sub" }, "例句"),
    ...exampleBlocks({ ex: u.examples }),
    h("h2", { class: "g-title v-sub" }, "常見錯誤"),
    h("div", { class: "ut-mistake" },
      h("p", { class: "ut-wrong", lang: "es" }, h("span", { class: "mk", "aria-label": "錯的" }, "✗"), " ", h("s", {}, m.wrong)),
      h("div", { class: "example ut-right" },
        h("div", {}, h("p", { class: "es", lang: "es" }, h("span", { class: "mk", "aria-label": "對的" }, "✓"), " ", m.right)),
        speakBtn(m.right, "播放正確的句子")),
      h("p", { class: "note", lang: "zh-Hant" }, m.why)),
    ...(u.notes ?? []).map((n) => h("p", { class: "note", lang: "zh-Hant" }, n)),
    h("p", { class: "muted small ut-src", lang: "zh-Hant" }, "說明是 AI 寫的，還沒人審。"),
    h("div", { class: "ut-actions" }, startBtn, skipBtn));
}

// ───────── 共用：一題一題出題的外框 ─────────
// mode "learn"：學單元，作答後按「下一題」，不評分；mode "review"：複習，作答後按四個評分鍵。
function drillShell(root, ctx, { nextQuestion, onAnswered, finishView, progressText, mode }) {
  document.body.classList.add("in-review");
  const wrap = h("div", { class: "review gdrill-wrap" });
  root.append(wrap);
  const typing = typingController(wrap);
  let turn = {};
  let typeInput = null;
  let busy = false;
  const ui = {
    wrap, typing,
    resetTurn() { turn = {}; },
    draw() {
      const q = nextQuestion();
      if (!q) { typing.set(false); wrap.replaceChildren(...finishView()); return; }
      const qv = questionView(q.drill, turn, {
        redraw: () => ui.draw(),
        onAnswer: (answer) => {
          turn.answer = answer;
          document.activeElement?.blur?.(); // 收起鍵盤
          onAnswered(q, answer);
          ui.draw();
        },
      });
      typeInput = qv.input ?? null;
      const answered = !!turn.answer;
      let actions = qv.actions;
      if (answered) {
        if (mode === "learn") {
          actions = h("button", { class: "btn primary block", type: "button", onclick: () => ui.next() }, "下一題");
        } else {
          const sug = suggestGrade(turn.answer.result);
          actions = h("div", { class: "grades" }, GRADES.map((gr) => h("button", {
            class: `grade${sug === gr.value ? " suggested" : ""}`, type: "button", "data-g": gr.value,
            "aria-label": sug === gr.value ? `${gr.label}（建議）` : false,
            onclick: () => ui.grade(gr.value),
          }, gr.label, sug === gr.value ? h("small", { class: "sug" }, "建議") : null)));
        }
      }
      typing.set(!answered && q.drill.type === "fill");
      wrap.replaceChildren(
        h("div", { class: "rv-top" },
          h("a", { class: "ghost", href: q.exitHref, style: "display:inline-flex;align-items:center" }, "結束"),
          h("span", { class: "prog" }, progressText(q))),
        h("div", { class: "rv-card" }, qv.front, answered ? resultBlock(q.drill, turn.answer) : null),
        h("div", { class: "rv-actions" }, actions));
      if (typeInput) typeInput.focus({ preventScroll: true });
    },
    async next() { if (busy) return; busy = true; try { await ui.onNext?.(); } finally { busy = false; } },
    async grade(g) { if (busy) return; busy = true; try { await ui.onGrade?.(g); } finally { busy = false; } },
  };
  ui.cleanup = () => { typing.set(false); document.body.classList.remove("in-review"); };
  return ui;
}

// ───────── 學單元 ─────────
export async function renderUnitDrill(root, ctx, id) {
  const { store } = ctx;
  document.body.classList.add("in-review");
  const g = await loadOrShowError(root);
  const data = g?.unitData[id];
  if (!g) { document.body.classList.remove("in-review"); return; }
  if (!data) { document.body.classList.remove("in-review"); root.append(h("a", { class: "back", href: "#/grammar" }, "‹ 文法"), h("p", { class: "empty" }, "這個單元還沒有內容。")); return; }
  const cards = await store.cards();
  const practiceOnly = data.drills.every((d) => cards.has(grammarCardId(d.id))); // 已經完成的單元：再練一次，不建卡、不改排程
  const total = data.drills.length;
  const queue = data.drills.map((drill) => ({ drill, attempt: 1 }));
  const results = {}; // 每題第一次作答的結果（建卡只看這個）
  let done = 0;

  const ui = drillShell(root, ctx, {
    mode: "learn",
    nextQuestion: () => (queue.length ? { ...queue[0], exitHref: `#/unit/${id}` } : null),
    progressText: (q) => `${Math.min(done + 1, total)} ／ ${total}${q.attempt === 2 ? "　再試一次" : ""}`,
    onAnswered: (q, answer) => {
      if (q.attempt === 1) results[q.drill.id] = answer.result;
    },
    finishView: () => doneView(),
  });

  ui.onNext = () => {
    const q = queue.shift();
    const r = results[q.drill.id];
    if (q.attempt === 1) {
      done++;
      if (r === "wrong" || r === "incorrect" || r === "accent") queue.push({ drill: q.drill, attempt: 2 }); // 錯的、只差重音的，最後再出一次（只一次）；建卡評分照第一次（只差重音＝2）
    }
    ui.resetTurn();
    if (queue.length) { ui.draw(); return; }
    return finishAndShow();
  };

  async function finishAndShow() {
    ui.typing.set(false);
    if (practiceOnly) { ui.wrap.replaceChildren(...doneView()); return; }
    ui.wrap.replaceChildren(h("div", { class: "done" }, h("p", {}, "正在存檔…")));
    const recs = finishLearning(data, results, new Date(), cards);
    let failed = 0;
    for (const rec of recs) { // 一張一張存；存完才顯示完成，失敗要明講有幾題沒存到
      try {
        await store.saveCard(rec);
        cards.set(rec.id, rec); // 重做時已經存好的不重建
        try { await store.addLog({ id: `${Date.now()}-${rec.id}`, cardId: rec.id, grade: gradeOf(results[rec.wordId]), at: Date.now() }); } catch (e) { console.error(e); }
      } catch (e) { console.error(e); failed++; }
    }
    ui.wrap.replaceChildren(...(failed ? failView(failed) : doneView()));
  }

  const gradeOf = (r) => ({ correct: 3, exact: 3, accent: 2 }[r] ?? 1);
  const firstRight = () => data.drills.filter((d) => results[d.id] === "correct" || results[d.id] === "exact").length;

  function doneView() {
    return [
      h("div", { class: "rv-top" }, h("span")),
      h("div", { class: "done", lang: "zh-Hant" },
        h("p", {}, practiceOnly ? `這次練了 ${total} 題，第一次就對 ${firstRight()} 題。這次不改複習排程。`
          : `完成 ${id}，${total} 題裡第一次就對 ${firstRight()} 題；題目會在之後的複習出現。`),
        h("a", { class: "btn primary block", href: "#/grammar" }, "回單元地圖")),
    ];
  }
  function failView(n) {
    return [
      h("div", { class: "rv-top" }, h("span")),
      h("div", { class: "done", lang: "zh-Hant" },
        h("p", {}, `有 ${n} 題沒存到，請再做一次。`),
        h("p", { class: "note" }, GRADE_FAIL_MESSAGE),
        h("button", { class: "btn primary block", type: "button", onclick: () => location.reload() }, "再做一次")),
    ];
  }

  ui.draw();
  return ui.cleanup;
}

// ───────── 複習到期題 ─────────
export async function renderGrammarReview(root, ctx) {
  const { store } = ctx;
  document.body.classList.add("in-review");
  const g = await loadOrShowError(root);
  if (!g) { document.body.classList.remove("in-review"); return; }
  const [cards, settings] = await Promise.all([store.cards(), store.settings()]);
  const queue = buildGrammarToday({ units: g.units, unitData: g.unitData, cards, settings, now: new Date() }).queue;
  let reviewed = 0;

  const ui = drillShell(root, ctx, {
    mode: "review",
    nextQuestion: () => {
      while (queue.length && !g.drillById.has(queue[0].wordId)) queue.shift(); // 資料裡已經沒有的題目不出
      return queue.length ? { drill: g.drillById.get(queue[0].wordId).drill, attempt: 1, exitHref: "#/today" } : null;
    },
    progressText: () => `剩 ${queue.length}`,
    onAnswered: () => {},
    finishView: () => [
      h("div", { class: "rv-top" }, h("span")),
      h("div", { class: "done" },
        h("p", {}, reviewed > 0 ? `這一輪完成了，複習 ${reviewed} 題。` : "今天沒有要複習的文法題。"),
        h("a", { class: "btn primary block", href: "#/today" }, "回到今日")),
    ],
  });

  ui.onGrade = async (gr) => {
    const r = await gradeStep({ store, cards, queue, grade: gr, now: new Date() });
    if (!r.ok) { // 存檔失敗：畫面留在這題，告訴他
      console.error(r.error);
      toast(r.message, TOAST_LONG_MS);
      return;
    }
    reviewed++;
    ui.resetTurn();
    ui.draw();
  };
  const onKey = (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (["1", "2", "3", "4"].includes(e.key) && document.querySelector(".grades")) ui.grade(Number(e.key));
  };
  document.addEventListener("keydown", onKey);
  ui.draw();
  return () => { document.removeEventListener("keydown", onKey); ui.cleanup(); };
}
