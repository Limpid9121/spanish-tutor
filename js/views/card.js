// 詞卡的共用零件：喇叭鍵、單字大字、答案區。
import { h, speakerIcon } from "../ui.js";
import * as speech from "../speech.js";
import { article, lenClass, posLabel, splitZh } from "../words.js";
import { promptText } from "../practice.js";

export function speakBtn(text, label = "播放發音") {
  const ok = speech.available();
  const b = h("button", {
    class: "speak", type: "button", "aria-label": label, "aria-disabled": ok ? false : "true",
    onclick: (e) => { e.stopPropagation(); speech.speak(text); },
  }, speakerIcon());
  return b;
}

// 西文大字（名詞前面有淡色冠詞）
export function spanishWord(word) {
  const a = article(word);
  const el = h("h1", { class: `word ${lenClass(a ? `${a} ${word.es}` : word.es)}`, lang: "es" },
    a ? [h("span", { class: "art" }, a), " "] : null, word.es); // 冠詞與單字之間放真的空白：太窄時整個單字換到下一行，不會從單字中間斷開
  return el;
}

export function chineseFront(word) {
  return h("h1", { class: "word zh-front", lang: "zh-Hant" }, promptText(word)); // 不能直接印出西文答案（1.3 審核必修 2）
}

export function posLine(word) {
  return h("p", { class: "pos" }, posLabel(word));
}

export function meaningBlock(word) {
  const { main, more } = splitZh(word.zh);
  return [h("p", { class: "meaning", lang: "zh-Hant" }, main), ...more.map((m) => h("p", { class: "more", lang: "zh-Hant" }, m))];
}

export function exampleBlocks(word) {
  return (word.ex ?? []).map((ex) => h("div", { class: "example" },
    h("div", {},
      h("p", { class: "es", lang: "es" }, ex.es),
      h("p", { class: "zh", lang: "zh-Hant" }, ex.zh),
      ex.tense_ok === false ? h("p", { class: "tense-note", lang: "zh-Hant" }, "含還沒學的時態") : null),
    speakBtn(ex.es, "播放例句")));
}
