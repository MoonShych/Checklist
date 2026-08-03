/* =========================================================
   ANIMATION.JS
   รวมฟังก์ชัน Animation ของแอปทั้งหมด
   ใช้เฉพาะ transform และ opacity เพื่อประสิทธิภาพสูงสุด (GPU accelerated)
   ห้ามใช้ Animation หนัก เช่น blur เต็มจอ หรือ particle
   ========================================================= */

const AnimationManager = (() => {

  /**
   * เล่น Animation เปลี่ยนหน้า (Page Transition)
   * @param {HTMLElement} el - element ของหน้าที่จะแสดง
   * @param {"forward"|"backward"} direction - ทิศทางการเปลี่ยนหน้า
   */
  function animatePageEnter(el, direction = "forward") {
    el.classList.remove("anim-enter-forward", "anim-enter-backward");
    // force reflow เพื่อให้ animation restart ได้ทุกครั้ง
    void el.offsetWidth;
    el.classList.add(direction === "forward" ? "anim-enter-forward" : "anim-enter-backward");
  }

  /**
   * Animation Pop ตอนติ๊ก Checkbox
   * @param {HTMLElement} checkboxEl
   */
  function animateCheckboxPop(checkboxEl) {
    checkboxEl.classList.remove("pop");
    void checkboxEl.offsetWidth;
    checkboxEl.classList.add("pop");
    checkboxEl.addEventListener("animationend", function handler() {
      checkboxEl.classList.remove("pop");
      checkboxEl.removeEventListener("animationend", handler);
    });
  }

  /**
   * Animation ตอนการ์ดถูกกด (Card Press) - ใช้ CSS :active เป็นหลัก
   * ฟังก์ชันนี้ใช้เพิ่ม feedback แบบ manual สำหรับ touch device บางรุ่น
   */
  function animateCardPress(cardEl) {
    cardEl.style.transform = "scale(0.98)";
    setTimeout(() => {
      cardEl.style.transform = "";
    }, 120);
  }

  /**
   * Animation เมื่อรายการถูกลบออกจากลิสต์
   * @param {HTMLElement} itemEl
   * @param {Function} onComplete - callback หลัง animation จบ (ใช้ลบ element ออกจริง)
   */
  function animateItemRemove(itemEl, onComplete) {
    itemEl.classList.add("is-removing");
    itemEl.addEventListener("animationend", function handler() {
      itemEl.removeEventListener("animationend", handler);
      if (typeof onComplete === "function") onComplete();
    });
  }

  /**
   * Animation เมื่อรายการใหม่ถูกเพิ่มเข้าลิสต์
   * @param {HTMLElement} itemEl
   */
  function animateItemEnter(itemEl) {
    itemEl.classList.add("is-entering");
    itemEl.addEventListener("animationend", function handler() {
      itemEl.classList.remove("is-entering");
      itemEl.removeEventListener("animationend", handler);
    });
  }

  /**
   * เปิด Modal / Popup ด้วย Fade + Slide up
   * @param {HTMLElement} overlayEl
   */
  function openModal(overlayEl) {
    overlayEl.hidden = false;
    // force reflow ก่อนใส่ class เพื่อให้ transition ทำงาน
    void overlayEl.offsetWidth;
    overlayEl.classList.add("is-open");
  }

  /**
   * ปิด Modal / Popup
   * @param {HTMLElement} overlayEl
   * @param {Function} onComplete
   */
  function closeModal(overlayEl, onComplete) {
    overlayEl.classList.remove("is-open");
    const sheet = overlayEl.querySelector(".modal-sheet, .confirm-dialog");
    const finish = () => {
      overlayEl.hidden = true;
      if (typeof onComplete === "function") onComplete();
    };
    if (sheet) {
      let done = false;
      sheet.addEventListener("transitionend", function handler() {
        if (done) return;
        done = true;
        sheet.removeEventListener("transitionend", handler);
        finish();
      });
      // fallback กันกรณี transitionend ไม่ยิง
      setTimeout(() => { if (!done) { done = true; finish(); } }, 260);
    } else {
      finish();
    }
  }

  /**
   * Animation ของ Navbar Indicator เมื่อเปลี่ยนแท็บ
   * @param {HTMLElement} indicatorEl
   * @param {number} index - ลำดับแท็บ (0-4)
   * @param {number} totalTabs
   */
  function animateNavIndicator(indicatorEl, index, totalTabs) {
    // translateX(%) is based on the element's OWN width, not parent's.
    // Since width = 100/totalTabs % of parent (== width of one tab slot),
    // moving by 100% per index aligns perfectly.
    indicatorEl.style.transform = `translateX(${index * 100}%)`;
    indicatorEl.style.width = `${100 / totalTabs}%`;
  }

  /**
   * Animation streak badge (pulse) เมื่อ streak เพิ่มขึ้น
   * @param {HTMLElement} badgeEl
   */
  function animateStreakPulse(badgeEl) {
    badgeEl.classList.remove("pulse");
    void badgeEl.offsetWidth;
    badgeEl.classList.add("pulse");
    badgeEl.addEventListener("animationend", function handler() {
      badgeEl.classList.remove("pulse");
      badgeEl.removeEventListener("animationend", handler);
    });
  }

  /**
   * Animation ตอนเปลี่ยนเดือนใน Calendar (fade เบาๆ)
   * @param {HTMLElement} gridEl
   */
  function animateCalendarTransition(gridEl) {
    gridEl.style.opacity = "0";
    gridEl.style.transform = "translateY(4px)";
    requestAnimationFrame(() => {
      gridEl.style.transition = "opacity 200ms ease, transform 200ms ease";
      gridEl.style.opacity = "1";
      gridEl.style.transform = "translateY(0)";
      setTimeout(() => {
        gridEl.style.transition = "";
      }, 220);
    });
  }

  /**
   * แสดง Toast message ชั่วคราว
   * @param {HTMLElement} toastEl
   * @param {string} message
   */
  let toastTimer = null;
  function showToast(toastEl, message) {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("is-visible");
    }, 2000);
  }

  return {
    animatePageEnter,
    animateCheckboxPop,
    animateCardPress,
    animateItemRemove,
    animateItemEnter,
    openModal,
    closeModal,
    animateNavIndicator,
    animateStreakPulse,
    animateCalendarTransition,
    showToast,
  };
})();