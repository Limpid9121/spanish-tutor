// 發音：瀏覽器內建 speechSynthesis。優先 Mónica、Paulina、Enhanced／Premium 聲音，避開機器感重的聲音；
// 語言優先 es-ES，再 es-MX，再其他西文聲音；都沒有就停用。
const PREFER = ["es-es", "es-mx"];
// iOS 16 以上附的一組機器感很重的合成聲音（審核第 5 題）：真的只剩它們時才勉強用
const AVOID = /\b(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/i;
const GOOD = /(M[óo]nica|Paulina|Enhanced|Premium)/i;

const norm = (v) => v.lang.replace("_", "-").toLowerCase();

export function pickVoice(voices) {
  const es = voices.filter((v) => /^es(-|$)/.test(norm(v)));
  const rank = (v) => {
    const name = v.name ?? "";
    const quality = GOOD.test(name) ? 0 : AVOID.test(name) ? 2 : 1;
    const lang = PREFER.indexOf(norm(v));
    return [quality, lang === -1 ? PREFER.length : lang];
  };
  let best = null;
  let bestRank = null;
  for (const v of es) { // 同分時取清單裡排前面的（用 > 而不是 >=）
    const r = rank(v);
    if (!best || r[0] < bestRank[0] || (r[0] === bestRank[0] && r[1] < bestRank[1])) { best = v; bestRank = r; }
  }
  return best;
}

// synth：speechSynthesis（測試時傳假的；沒有就整個停用）
export function createSpeech(synth) {
  let voice = null;
  const listeners = new Set();
  // iOS 一開始常常拿到空的聲音清單，也不一定會發 voiceschanged：所以每次要用時都重新讀（審核第 5 題）
  const reread = () => { voice = synth ? pickVoice(synth.getVoices()) : null; return voice; };
  const notify = () => { reread(); listeners.forEach((fn) => fn(voice)); };
  if (synth) {
    reread();
    synth.addEventListener?.("voiceschanged", notify);
  }
  return {
    available: () => !!reread(),
    voiceInfo: () => { reread(); return voice ? `${voice.name}（${voice.lang}）` : null; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    speak(text) {
      if (!synth || !reread()) return false;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = 0.9;
      synth.speak(u);
      return true;
    },
  };
}

const inst = createSpeech(typeof window !== "undefined" ? window.speechSynthesis : undefined);
export const { available, voiceInfo, onChange, speak } = inst;
