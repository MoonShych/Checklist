/* =========================================================
   SOUND.JS
   ระบบเสียงเอฟเฟกต์ของแอป
   ใช้ Web Audio API สังเคราะห์เสียงขึ้นเอง (ไม่ต้องใช้ไฟล์เสียงภายนอก
   เพื่อให้แอปทำงาน Offline ได้ 100% และไฟล์แอปมีขนาดเล็ก)
   ========================================================= */

const SoundManager = (() => {
  let audioCtx = null;
  let enabled = true;

  /* ตั้งค่าเปิด/ปิดเสียง */
  function setEnabled(value) {
    enabled = !!value;
  }

  function getEnabled() {
    return enabled;
  }

  /* สร้าง AudioContext แบบ Lazy (ต้องรอ user gesture ก่อนตาม policy ของ browser) */
  function ensureContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  /**
   * เล่นเสียง tone เดียว
   * @param {number} freq - ความถี่ (Hz)
   * @param {number} duration - ระยะเวลา (วินาที)
   * @param {string} type - waveform: sine / triangle / square
   * @param {number} startTime - เวลาเริ่ม (offset จากปัจจุบัน)
   * @param {number} volume - ความดัง 0-1
   */
  function playTone(freq, duration, type = "sine", startTime = 0, volume = 0.18) {
    const ctx = ensureContext();
    if (!ctx || !enabled) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    const now = ctx.currentTime + startTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /* เสียงติ๊กเช็คกล่อง (checkbox) - เสียงสั้น กระชับ สดใส */
  function playCheck() {
    playTone(880, 0.09, "sine", 0, 0.16);
    playTone(1320, 0.09, "sine", 0.05, 0.1);
  }

  /* เสียงยกเลิกการเช็ก - โทนต่ำกว่านิดหน่อย */
  function playUncheck() {
    playTone(440, 0.08, "sine", 0, 0.13);
  }

  /* เสียงบันทึกข้อมูล */
  function playSave() {
    playTone(660, 0.1, "triangle", 0, 0.15);
    playTone(880, 0.14, "triangle", 0.08, 0.15);
  }

  /* เสียงลบรายการ */
  function playDelete() {
    playTone(300, 0.16, "triangle", 0, 0.14);
    playTone(180, 0.18, "triangle", 0.05, 0.12);
  }

  /* เสียงสำเร็จ (เช่น ทำครบทุกรายการของวัน) */
  function playSuccess() {
    playTone(523.25, 0.12, "sine", 0, 0.15);
    playTone(659.25, 0.12, "sine", 0.1, 0.15);
    playTone(783.99, 0.2, "sine", 0.2, 0.16);
  }

  /* เสียงเปิด popup / modal */
  function playPopup() {
    playTone(500, 0.08, "sine", 0, 0.1);
    playTone(700, 0.08, "sine", 0.04, 0.1);
  }

  /* เสียงปิด popup / modal */
  function playPopupClose() {
    playTone(500, 0.07, "sine", 0, 0.09);
  }

  /* เสียงเมื่อ Streak เพิ่มขึ้น - เสียงฉลองพิเศษ */
  function playStreak() {
    playTone(523.25, 0.1, "triangle", 0, 0.16);
    playTone(659.25, 0.1, "triangle", 0.08, 0.16);
    playTone(783.99, 0.1, "triangle", 0.16, 0.16);
    playTone(1046.5, 0.22, "triangle", 0.24, 0.18);
  }

  return {
    setEnabled,
    getEnabled,
    playCheck,
    playUncheck,
    playSave,
    playDelete,
    playSuccess,
    playPopup,
    playPopupClose,
    playStreak,
  };
})();
