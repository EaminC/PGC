/* =========================================================
 * swing.js — 高尔夫挥杆音效（Web Audio 合成，零依赖）
 *
 * 用法：
 *   SwingSFX.play();            // 默认挥杆音（whoosh + thwack）
 *   SwingSFX.play('soft');      // 弱一点的（可选：bogey 用）
 *   SwingSFX.play('hard');      // 猛一点的（可选：birdie 用）
 *
 * 设计：
 *   - 前 180ms: 噪声经 bandpass 扫频 → "嗖" 的破空声
 *   - 180-320ms: triangle osc 从 220Hz 滑到 60Hz → "啪" 的击球感
 *
 * 注意：必须在用户手势（点击/键盘）里首次调用，浏览器才会放声。
 * ========================================================= */

(function () {
  let ctx = null;
  let noiseBuffer = null;

  function ensureCtx() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") {
      // 用户手势里直接 resume 即可，浏览器允许
      ctx.resume();
    }
    return ctx;
  }

  function getNoiseBuffer(audio) {
    if (noiseBuffer && noiseBuffer.sampleRate === audio.sampleRate) {
      return noiseBuffer;
    }
    const durationSec = 0.6;
    const length = Math.floor(durationSec * audio.sampleRate);
    noiseBuffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    // 白色噪声
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  function play(variant) {
    const audio = ensureCtx();
    if (!audio) return;
    const t0 = audio.currentTime;

    // 强度：normal=1, soft=0.6, hard=1.3
    const intensity =
      variant === "soft" ? 0.6 : variant === "hard" ? 1.3 : 1;

    // ---- whoosh：bandpass 扫频噪声 ----
    const noise = audio.createBufferSource();
    noise.buffer = getNoiseBuffer(audio);

    const bandpass = audio.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.Q.value = 1.2;
    bandpass.frequency.setValueAtTime(280, t0);
    bandpass.frequency.exponentialRampToValueAtTime(2200, t0 + 0.16);
    bandpass.frequency.exponentialRampToValueAtTime(500, t0 + 0.42);

    const noiseGain = audio.createGain();
    noiseGain.gain.setValueAtTime(0, t0);
    noiseGain.gain.linearRampToValueAtTime(0.32 * intensity, t0 + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);

    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(audio.destination);

    noise.start(t0);
    noise.stop(t0 + 0.46);

    // ---- thwack：低频 triangle 短脉冲 ----
    const osc = audio.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, t0 + 0.18);
    osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.26);

    const oscGain = audio.createGain();
    oscGain.gain.setValueAtTime(0, t0);
    oscGain.gain.linearRampToValueAtTime(0.5 * intensity, t0 + 0.18);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);

    osc.connect(oscGain);
    oscGain.connect(audio.destination);

    osc.start(t0 + 0.18);
    osc.stop(t0 + 0.34);
  }

  window.SwingSFX = { play };
})();
