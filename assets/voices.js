/* =========================================================
 * voices.js — character-aware speech helper for OGC games
 *
 * 用法：
 *   OGCVoice.speak("道歉的话", "eamin");     // 打断当前 + 立刻播
 *   OGCVoice.queueSpeak("都是 Eamin 不好", "j", { rate: 1.5 }); // 入队轮播
 *   OGCVoice.clearSpeech();                  // 清空队列 + cancel
 *
 * 内部会：
 *   1) 按 profile 设 pitch / rate 区分性别
 *   2) 尝试在系统语音里找更贴合的中文声线
 *   3) 找不到就 fallback 到任意中文声线，再 fallback 到默认
 * ========================================================= */

(function () {
  const PROFILES = {
    // 男：pitch 压低，rate 略慢
    eamin: { pitch: 0.85, rate: 0.95, voiceHint: "male" },
    // 女：pitch 拉高
    j: { pitch: 1.3, rate: 1.0, voiceHint: "female" },
    // 年轻女：pitch 更高、rate 略快
    andy: { pitch: 1.45, rate: 1.05, voiceHint: "female-young" },
    // 男（中发）：比 eamin 略亮、节奏正常 — Follow 的播报员
    wangzai: { pitch: 0.95, rate: 1.0, voiceHint: "male" },
  };

  // 关键词 → 优先匹配的中文语音名（按平台常见命名）
  const VOICE_HINTS = {
    male: [
      "KangKang",
      "Yunxi",
      "Yunjian",
      "Haoxiang",
      "Zhichu",
      "Lisheng",
      "Wanlung",
      "Danny",
      "Aaron",
    ],
    female: [
      "Xiaoxiao",
      "Xiaoyi",
      "Xiaoyou",
      "Xiaomeng",
      "HsiaoChen",
      "HsiaoYu",
      "Tingting",
      "Sin-ji",
      "Mei-Jia",
      "Yating",
    ],
    "female-young": [
      "Xiaoxiao",
      "Xiaoyou",
      "HsiaoChen",
      "Yating",
      "Tingting",
    ],
  };

  let voicesCache = null;

  // 提前声明：speak / processQueue 都会用到这两个状态
  const speechQueue = [];
  let speaking = false;
  // 兜底定时器句柄：onend 失火时强制推进队列
  let fallbackTimer = null;

  function loadVoices() {
    if (!("speechSynthesis" in window)) return [];
    const v = window.speechSynthesis.getVoices();
    voicesCache = v && v.length ? v : [];
    return voicesCache;
  }

  function pickVoice(hint) {
    const voices = voicesCache || loadVoices();
    if (!voices.length) return null;

    const keywords = VOICE_HINTS[hint] || [];
    for (const kw of keywords) {
      const found = voices.find((v) =>
        (v.name + " " + (v.voiceURI || "")).toLowerCase().includes(kw.toLowerCase())
      );
      if (found) return found;
    }
    // fallback：任意中文 voice
    const zh = voices.find((v) => /zh|chinese|cmn/i.test(v.lang));
    return zh || voices[0];
  }

  function speak(text, profileId) {
    if (!("speechSynthesis" in window)) return;
    const profile = PROFILES[profileId] || { pitch: 1.0, rate: 1.0 };

    try {
      // cancel 模式：打断一切，包括排队的指责
      window.speechSynthesis.cancel();
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      speechQueue.length = 0;
      speaking = false;

      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = "zh-CN";
      u.pitch = profile.pitch;
      u.rate = profile.rate;
      const v = pickVoice(profile.voiceHint);
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    } catch (e) {
      // 静默失败，不影响游戏
      console.warn("[OGCVoice] speak failed:", e);
    }
  }

  function processQueue() {
    if (!speechQueue.length) {
      speaking = false;
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      return;
    }
    speaking = true;
    const { text, profile } = speechQueue.shift();

    // 用 advanced flag 防止 onend + 兜底定时器双触发
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
      setTimeout(processQueue, 40);
    };

    try {
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = "zh-CN";
      u.pitch = profile.pitch;
      u.rate = profile.rate;
      const v = pickVoice(profile.voiceHint);
      if (v) u.voice = v;

      u.onend = advance;
      u.onerror = advance;

      // 兜底定时器：onend 在某些浏览器/TTS 引擎下不触发
      // 中文每字约 280ms / rate，加缓冲
      const durationMs = Math.max(
        900,
        Math.round((text.length * 280) / profile.rate) + 500
      );
      fallbackTimer = setTimeout(advance, durationMs);

      window.speechSynthesis.speak(u);
    } catch (e) {
      advance();
    }
  }

  function queueSpeak(text, profileId, overrides) {
    if (!("speechSynthesis" in window)) return;
    const base = PROFILES[profileId] || { pitch: 1.0, rate: 1.0 };
    const profile =
      overrides && typeof overrides === "object"
        ? Object.assign({}, base, overrides)
        : base;
    speechQueue.push({ text: String(text), profile });
    if (!speaking) processQueue();
  }

  function clearSpeech() {
    speechQueue.length = 0;
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speaking = false;
  }

  // 首次预热 + 监听 voiceschanged（Chrome 需要）
  if ("speechSynthesis" in window) {
    loadVoices();
    if (typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    }
  }

  window.OGCVoice = { speak, queueSpeak, clearSpeech, PROFILES, pickVoice };
})();
