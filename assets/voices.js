/* =========================================================
 * voices.js — character-aware speech helper for OGC games
 *
 * 用法：
 *   OGCVoice.speak("道歉的话", "eamin");   // 用男声
 *   OGCVoice.speak("道歉的话", "j");        // 用女声
 *   OGCVoice.speak("道歉的话", "andy");     // 用年轻女声
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
      window.speechSynthesis.cancel();
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

  // 首次预热 + 监听 voiceschanged（Chrome 需要）
  if ("speechSynthesis" in window) {
    loadVoices();
    if (typeof window.speechSynthesis.addEventListener === "function") {
      window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    }
  }

  window.OGCVoice = { speak, PROFILES, pickVoice };
})();
