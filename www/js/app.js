/* =========================================================
   APP.JS
   Logic หลักของแอป Checklist
   - จัดการ State ทั้งหมด
   - อ่าน/เขียน LocalStorage
   - Render แต่ละหน้า (Home, Calendar, Add, Statistics, Settings)
   - จัดการ Event ทั้งหมดด้วย Event Delegation
   ========================================================= */

(() => {
  "use strict";

  /* ============ 1. STORAGE KEYS & DATA STRUCTURE ============ */
  const STORAGE_KEYS = {
    ITEMS: "checklist_items_v1",
    CATEGORIES: "checklist_categories_v1",
    SETTINGS: "checklist_settings_v1",
    STREAK: "checklist_streak_v1",
    COMPLETIONS: "checklist_completions_v1",
  };

  const DEFAULT_CATEGORIES = [
    { id: "cat-general", name: "ทั่วไป", color: "#4A90E2" },
    { id: "cat-health", name: "สุขภาพ", color: "#34C759" },
    { id: "cat-work", name: "งาน", color: "#FF9500" },
    { id: "cat-study", name: "การเรียน", color: "#AF52DE" },
  ];

  const DEFAULT_SETTINGS = { sound: true, chartType: "pie" };
  const DEFAULT_STREAK = { current: 0, best: 0, lastCompletedDate: null };

  const NAV_ORDER = ["home", "calendar", "add", "stats", "settings"];

  const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const THAI_WEEKDAY_FULL = [
    "วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์",
  ];
  const THAI_WEEKDAY_SHORT_MON_START = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

  /* ============ 2. STORAGE HELPERS ============ */
  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Storage error:", e);
    }
  }

  /* ============ 3. APP STATE ============ */
  const state = {
    categories: [],
    items: [],
    completions: {}, // { "YYYY-MM-DD": ["itemId", ...] }
    settings: { ...DEFAULT_SETTINGS },
    streak: { ...DEFAULT_STREAK },
    ui: {
      currentPage: "home",
      homeFilterCategory: "all",
      homeSearchTerm: "",
      calendarYear: 0,
      calendarMonth: 0, // 0-based
      calendarSelectedDate: "", // YYYY-MM-DD
      statsYear: 0,
      statsMonth: 0,
      statsChartType: "pie",
      editingItemId: null,
      scheduleType: "once",
      formSelectedCategoryId: null,
      formSelectedWeekdays: new Set(),
      formSelectedMonthDays: new Set(),
      pendingConfirmCallback: null,
    },
  };

  function loadAllData() {
    state.categories = loadJSON(STORAGE_KEYS.CATEGORIES, null) || [...DEFAULT_CATEGORIES];
    state.items = loadJSON(STORAGE_KEYS.ITEMS, []);
    state.completions = loadJSON(STORAGE_KEYS.COMPLETIONS, {});
    state.settings = { ...DEFAULT_SETTINGS, ...loadJSON(STORAGE_KEYS.SETTINGS, {}) };
    state.streak = { ...DEFAULT_STREAK, ...loadJSON(STORAGE_KEYS.STREAK, {}) };
  }

  function persistItems() { saveJSON(STORAGE_KEYS.ITEMS, state.items); }
  function persistCategories() { saveJSON(STORAGE_KEYS.CATEGORIES, state.categories); }
  function persistCompletions() { saveJSON(STORAGE_KEYS.COMPLETIONS, state.completions); }
  function persistSettings() { saveJSON(STORAGE_KEYS.SETTINGS, state.settings); }
  function persistStreak() { saveJSON(STORAGE_KEYS.STREAK, state.streak); }

  /* ============ 4. DATE HELPERS ============ */
  function todayDate() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseDateKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function toBuddhistYear(gregorianYear) {
    return gregorianYear + 543;
  }

  function formatFullThaiDate(date) {
    const day = date.getDate();
    const month = THAI_MONTHS[date.getMonth()];
    const year = toBuddhistYear(date.getFullYear());
    return `${day} ${month} ${year}`;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  /* Monday-first weekday index: 0=Mon ... 6=Sun */
  function mondayFirstIndex(date) {
    return (date.getDay() + 6) % 7;
  }

  /* ============ 5. CATEGORY HELPERS ============ */
  function getCategoryById(categoryId) {
    return state.categories.find((c) => c.id === categoryId) || null;
  }

  function getCategoryColor(categoryId) {
    const cat = getCategoryById(categoryId);
    return cat ? cat.color : "#B0B8C4";
  }

  function getCategoryName(categoryId) {
    const cat = getCategoryById(categoryId);
    return cat ? cat.name : "ไม่มีหมวดหมู่";
  }

  /* ============ 6. ITEM SCHEDULING LOGIC ============ */
  function itemCreatedDateKey(item) {
    return formatDateKey(new Date(item.createdAt));
  }

  function itemAppliesOnDate(item, date) {
    const dateKey = formatDateKey(date);
    if (dateKey < itemCreatedDateKey(item)) return false;

    const sched = item.schedule;
    switch (sched.type) {
      case "once":
        return sched.date === dateKey;
      case "daily":
        return true;
      case "weekly":
        return Array.isArray(sched.days) && sched.days.includes(date.getDay());
      case "monthly":
        return Array.isArray(sched.datesOfMonth) && sched.datesOfMonth.includes(date.getDate());
      default:
        return false;
    }
  }

  function getItemsForDate(date) {
    return state.items.filter((item) => itemAppliesOnDate(item, date));
  }

  function isItemCompletedOn(itemId, dateKey) {
    const list = state.completions[dateKey];
    return Array.isArray(list) && list.includes(itemId);
  }

  function toggleItemCompletion(itemId, dateKey) {
    if (!state.completions[dateKey]) state.completions[dateKey] = [];
    const list = state.completions[dateKey];
    const idx = list.indexOf(itemId);
    let nowChecked;
    if (idx >= 0) {
      list.splice(idx, 1);
      nowChecked = false;
    } else {
      list.push(itemId);
      nowChecked = true;
    }
    if (list.length === 0) delete state.completions[dateKey];
    persistCompletions();
    recalcStreak();
    return nowChecked;
  }

  /* ============ 7. STREAK LOGIC ============ */
  function recalcStreak() {
    const prevCurrent = state.streak.current;
    let current = 0;
    const cursor = todayDate();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const key = formatDateKey(cursor);
      const list = state.completions[key];
      if (Array.isArray(list) && list.length > 0) {
        current++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    state.streak.current = current;
    if (current > state.streak.best) state.streak.best = current;
    const todayKey = formatDateKey(todayDate());
    const todayList = state.completions[todayKey];
    if (Array.isArray(todayList) && todayList.length > 0) {
      state.streak.lastCompletedDate = todayKey;
    }
    persistStreak();
    return current > prevCurrent;
  }

  /* ============ 8. DOM REFERENCES ============ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = {
    app: $("#app"),
    bottomNav: $("#bottomNav"),
    navIndicator: $("#navIndicator"),
    toast: $("#toast"),

    // Home
    homeDateDay: $("#homeDateDay"),
    homeDateFull: $("#homeDateFull"),
    streakBadge: $("#streakBadge"),
    streakCount: $("#streakCount"),
    summaryDoneCount: $("#summaryDoneCount"),
    summaryTotalCount: $("#summaryTotalCount"),
    homeProgressFill: $("#homeProgressFill"),
    homeSearchInput: $("#homeSearchInput"),
    homeCategoryFilter: $("#homeCategoryFilter"),
    homeChecklistList: $("#homeChecklistList"),
    homeEmptyState: $("#homeEmptyState"),

    // Calendar
    calPrevBtn: $("#calPrevBtn"),
    calNextBtn: $("#calNextBtn"),
    calMonthLabel: $("#calMonthLabel"),
    calendarGrid: $("#calendarGrid"),
    calSelectedDayTitle: $("#calSelectedDayTitle"),
    calChecklistList: $("#calChecklistList"),
    calEmptyState: $("#calEmptyState"),

    // Add form
    addPageTitle: $("#addPageTitle"),
    addForm: $("#addForm"),
    itemNameInput: $("#itemNameInput"),
    categoryPicker: $("#categoryPicker"),
    manageCategoryBtn: $("#manageCategoryBtn"),
    itemDescInput: $("#itemDescInput"),
    scheduleDetailOnce: $("#scheduleDetailOnce"),
    scheduleDetailWeekly: $("#scheduleDetailWeekly"),
    scheduleDetailMonthly: $("#scheduleDetailMonthly"),
    onceDateInput: $("#onceDateInput"),
    weekdayPicker: $("#weekdayPicker"),
    monthdayPicker: $("#monthdayPicker"),
    saveItemBtn: $("#saveItemBtn"),
    cancelEditBtn: $("#cancelEditBtn"),

    // Statistics
    statsPrevBtn: $("#statsPrevBtn"),
    statsNextBtn: $("#statsNextBtn"),
    statsMonthLabel: $("#statsMonthLabel"),
    statsTotalValue: $("#statsTotalValue"),
    statsDoneValue: $("#statsDoneValue"),
    statsPendingValue: $("#statsPendingValue"),
    statsChartSvg: $("#statsChartSvg"),
    statsChartLegend: $("#statsChartLegend"),
    statsCategoryList: $("#statsCategoryList"),

    // Settings
    settingsChartTypeSeg: $("#settingsChartTypeSeg"),
    settingsManageCategoryBtn: $("#settingsManageCategoryBtn"),
    settingsSoundToggle: $("#settingsSoundToggle"),
    settingsClearDataBtn: $("#settingsClearDataBtn"),

    // Category modal
    categoryModalOverlay: $("#categoryModalOverlay"),
    categoryManageList: $("#categoryManageList"),
    newCategoryNameInput: $("#newCategoryNameInput"),
    newCategoryColorInput: $("#newCategoryColorInput"),
    addCategoryBtn: $("#addCategoryBtn"),
    closeCategoryModalBtn: $("#closeCategoryModalBtn"),

    // Confirm dialog
    confirmDialogOverlay: $("#confirmDialogOverlay"),
    confirmDialogTitle: $("#confirmDialogTitle"),
    confirmDialogMsg: $("#confirmDialogMsg"),
    confirmDialogCancelBtn: $("#confirmDialogCancelBtn"),
    confirmDialogOkBtn: $("#confirmDialogOkBtn"),
  };

  /* ============ 9. TOAST / CONFIRM HELPERS ============ */
  function toast(message) {
    AnimationManager.showToast(el.toast, message);
  }

  function showConfirm(title, message, onConfirm) {
    el.confirmDialogTitle.textContent = title;
    el.confirmDialogMsg.textContent = message;
    state.ui.pendingConfirmCallback = onConfirm;
    AnimationManager.openModal(el.confirmDialogOverlay);
    SoundManager.playPopup();
  }

  function hideConfirm() {
    AnimationManager.closeModal(el.confirmDialogOverlay);
  }

  /* ============ 10. NAVIGATION ============ */
  function switchPage(pageName, options = {}) {
    const fromIndex = NAV_ORDER.indexOf(state.ui.currentPage);
    const toIndex = NAV_ORDER.indexOf(pageName);
    const direction = toIndex >= fromIndex ? "forward" : "backward";

    state.ui.currentPage = pageName;

    $$(".page").forEach((p) => p.classList.remove("is-active"));
    $$(".nav-item").forEach((n) => n.classList.remove("active"));

    const targetPage = $(`#page-${pageName}`);
    const targetNav = $(`.nav-item[data-nav="${pageName}"]`);
    targetPage.classList.add("is-active");
    if (targetNav) targetNav.classList.add("active");

    AnimationManager.animatePageEnter(targetPage, direction);
    AnimationManager.animateNavIndicator(el.navIndicator, toIndex, NAV_ORDER.length);

    if (!options.silent) {
      if (pageName === "home") renderHome();
      if (pageName === "calendar") renderCalendarPage();
      if (pageName === "add" && !options.forEdit) resetAddForm();
      if (pageName === "stats") renderStatsPage();
      if (pageName === "settings") renderSettingsPage();
    }
  }

  el.bottomNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    switchPage(btn.dataset.nav);
  });

  /* ============ 11. HOME PAGE RENDER ============ */
  function renderHomeHeader() {
    const now = new Date();
    el.homeDateDay.textContent = THAI_WEEKDAY_FULL[now.getDay()];
    el.homeDateFull.textContent = formatFullThaiDate(now);
    el.streakCount.textContent = state.streak.current;
  }

  function renderHomeCategoryFilter() {
    const chips = [`<button class="filter-chip${state.ui.homeFilterCategory === "all" ? " active" : ""}" data-filter-category="all">ทั้งหมด</button>`];
    state.categories.forEach((cat) => {
      const active = state.ui.homeFilterCategory === cat.id ? " active" : "";
      chips.push(
        `<button class="filter-chip${active}" data-filter-category="${cat.id}">` +
          `<span class="filter-chip-dot" style="background:${cat.color}"></span>${escapeHTML(cat.name)}</button>`
      );
    });
    el.homeCategoryFilter.innerHTML = chips.join("");
  }

  function buildChecklistItemHTML(item, dateKey) {
    const done = isItemCompletedOn(item.id, dateKey);
    const color = getCategoryColor(item.categoryId);
    const catName = getCategoryName(item.categoryId);
    return `
      <li class="checklist-item is-entering" data-item-id="${item.id}" data-date-key="${dateKey}">
        <button class="item-checkbox${done ? " checked" : ""}" data-action="toggle" aria-label="เช็ก">
          <svg class="item-check-icon" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5L6.2 11.5L13 4.5" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="item-content" data-action="edit">
          <p class="item-name${done ? " is-done" : ""}">${escapeHTML(item.name)}</p>
          <div class="item-meta">
            <span class="item-category-dot" style="background:${color}"></span>
            <span class="item-category-name">${escapeHTML(catName)}</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="item-action-btn" data-action="edit" aria-label="แก้ไข">✏️</button>
          <button class="item-action-btn" data-action="delete" aria-label="ลบ">🗑️</button>
        </div>
      </li>`;
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  function renderHomeChecklist() {
    const todayKey = formatDateKey(todayDate());
    const allTodayItems = getItemsForDate(todayDate());

    // ความคืบหน้ารวมของวันนี้ (ไม่กรองตามหมวด/คำค้นหา)
    const doneCount = allTodayItems.filter((it) => isItemCompletedOn(it.id, todayKey)).length;
    const totalCount = allTodayItems.length;
    el.summaryDoneCount.textContent = doneCount;
    el.summaryTotalCount.textContent = totalCount;
    el.homeProgressFill.style.width = totalCount > 0 ? `${Math.round((doneCount / totalCount) * 100)}%` : "0%";

    // กรองตามหมวดหมู่ + คำค้นหา สำหรับแสดงผลลิสต์
    let visibleItems = allTodayItems;
    if (state.ui.homeFilterCategory !== "all") {
      visibleItems = visibleItems.filter((it) => it.categoryId === state.ui.homeFilterCategory);
    }
    if (state.ui.homeSearchTerm.trim()) {
      const term = state.ui.homeSearchTerm.trim().toLowerCase();
      visibleItems = visibleItems.filter((it) => it.name.toLowerCase().includes(term));
    }

    // เรียง: ยังไม่เสร็จก่อน แล้วตามด้วยเสร็จแล้ว
    const notDone = visibleItems.filter((it) => !isItemCompletedOn(it.id, todayKey));
    const done = visibleItems.filter((it) => isItemCompletedOn(it.id, todayKey));
    const ordered = [...notDone, ...done];

    if (ordered.length === 0) {
      el.homeChecklistList.innerHTML = "";
      el.homeEmptyState.hidden = false;
    } else {
      el.homeEmptyState.hidden = true;
      el.homeChecklistList.innerHTML = ordered.map((it) => buildChecklistItemHTML(it, todayKey)).join("");
    }
  }

  function renderHome() {
    renderHomeHeader();
    renderHomeCategoryFilter();
    renderHomeChecklist();
  }

  el.homeCategoryFilter.addEventListener("click", (e) => {
    const chip = e.target.closest(".filter-chip");
    if (!chip) return;
    state.ui.homeFilterCategory = chip.dataset.filterCategory;
    renderHomeCategoryFilter();
    renderHomeChecklist();
  });

  let searchDebounce = null;
  el.homeSearchInput.addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    const value = e.target.value;
    searchDebounce = setTimeout(() => {
      state.ui.homeSearchTerm = value;
      renderHomeChecklist();
    }, 120);
  });

  function handleChecklistItemClick(e, listRootSelector) {
    const li = e.target.closest(".checklist-item");
    if (!li) return;
    const itemId = li.dataset.itemId;
    const dateKey = li.dataset.dateKey;
    const actionEl = e.target.closest("[data-action]");
    const action = actionEl ? actionEl.dataset.action : null;

    if (action === "toggle") {
      const checkbox = li.querySelector(".item-checkbox");
      const wasAllDoneBefore = isAllDoneForDate(dateKey);
      const nowChecked = toggleItemCompletion(itemId, dateKey);
      AnimationManager.animateCheckboxPop(checkbox);
      if (nowChecked) {
        SoundManager.playCheck();
      } else {
        SoundManager.playUncheck();
      }
      const streakIncreased = dateKey === formatDateKey(todayDate()) ? recalcStreakAndCheckIncrease() : false;
      if (streakIncreased) {
        AnimationManager.animateStreakPulse(el.streakBadge);
        SoundManager.playStreak();
      }
      const nowAllDone = isAllDoneForDate(dateKey);
      if (nowChecked && nowAllDone && !wasAllDoneBefore) {
        setTimeout(() => SoundManager.playSuccess(), 160);
      }
      refreshAllRelevantViews(dateKey);
    } else if (action === "edit") {
      openAddFormForEdit(itemId);
    } else if (action === "delete") {
      const item = state.items.find((it) => it.id === itemId);
      showConfirm("ลบรายการ", `ต้องการลบ "${item ? item.name : ""}" ใช่หรือไม่?`, () => {
        deleteItem(itemId);
      });
    }
  }

  function isAllDoneForDate(dateKey) {
    const items = getItemsForDate(parseDateKey(dateKey));
    if (items.length === 0) return false;
    return items.every((it) => isItemCompletedOn(it.id, dateKey));
  }

  // เก็บ current streak ไว้เทียบก่อน toggle เพื่อรู้ว่าเพิ่มขึ้นหรือไม่ (ใช้เฉพาะวันนี้)
  function recalcStreakAndCheckIncrease() {
    return recalcStreak();
  }

  function refreshAllRelevantViews(dateKey) {
    if (state.ui.currentPage === "home") renderHome();
    if (state.ui.currentPage === "calendar" && dateKey === state.ui.calendarSelectedDate) {
      renderCalendarSelectedList();
      renderCalendarGrid();
    }
    if (state.ui.currentPage === "home") {
      // อัปเดต badge streak เสมอแม้ query จากหน้าอื่น
    }
    el.streakCount.textContent = state.streak.current;
  }

  el.homeChecklistList.addEventListener("click", (e) => handleChecklistItemClick(e));

  /* ============ 12. CALENDAR PAGE ============ */
  function renderCalendarMonthLabel() {
    el.calMonthLabel.textContent = `${THAI_MONTHS[state.ui.calendarMonth]} ${toBuddhistYear(state.ui.calendarYear)}`;
  }

  function renderCalendarGrid() {
    const year = state.ui.calendarYear;
    const month = state.ui.calendarMonth;
    const firstDay = new Date(year, month, 1);
    const leadingEmpty = mondayFirstIndex(firstDay);
    const totalDays = daysInMonth(year, month);
    const todayKey = formatDateKey(todayDate());

    let html = "";
    for (let i = 0; i < leadingEmpty; i++) {
      html += `<div class="cal-day-cell is-empty"></div>`;
    }
    for (let day = 1; day <= totalDays; day++) {
      const cellDate = new Date(year, month, day);
      const cellKey = formatDateKey(cellDate);
      const itemsForDay = getItemsForDate(cellDate);
      const uniqueColors = [...new Set(itemsForDay.map((it) => getCategoryColor(it.categoryId)))].slice(0, 4);
      const dots = uniqueColors.map((c) => `<span class="cal-day-dot" style="background:${c}"></span>`).join("");
      const isToday = cellKey === todayKey ? " is-today" : "";
      const isSelected = cellKey === state.ui.calendarSelectedDate ? " is-selected" : "";
      html += `
        <button class="cal-day-cell${isToday}${isSelected}" data-date-key="${cellKey}">
          <span class="cal-day-number">${day}</span>
          <span class="cal-day-dots">${dots}</span>
        </button>`;
    }
    el.calendarGrid.innerHTML = html;
  }

  function renderCalendarSelectedList() {
    const dateKey = state.ui.calendarSelectedDate;
    const date = parseDateKey(dateKey);
    const todayKey = formatDateKey(todayDate());
    el.calSelectedDayTitle.textContent =
      dateKey === todayKey ? "รายการวันนี้" : `รายการวันที่ ${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${toBuddhistYear(date.getFullYear())}`;

    const items = getItemsForDate(date);
    if (items.length === 0) {
      el.calChecklistList.innerHTML = "";
      el.calEmptyState.hidden = false;
    } else {
      el.calEmptyState.hidden = true;
      el.calChecklistList.innerHTML = items.map((it) => buildChecklistItemHTML(it, dateKey)).join("");
    }
  }

  function renderCalendarPage() {
    renderCalendarMonthLabel();
    renderCalendarGrid();
    renderCalendarSelectedList();
  }

  el.calPrevBtn.addEventListener("click", () => {
    state.ui.calendarMonth--;
    if (state.ui.calendarMonth < 0) {
      state.ui.calendarMonth = 11;
      state.ui.calendarYear--;
    }
    renderCalendarMonthLabel();
    renderCalendarGrid();
    AnimationManager.animateCalendarTransition(el.calendarGrid);
  });

  el.calNextBtn.addEventListener("click", () => {
    state.ui.calendarMonth++;
    if (state.ui.calendarMonth > 11) {
      state.ui.calendarMonth = 0;
      state.ui.calendarYear++;
    }
    renderCalendarMonthLabel();
    renderCalendarGrid();
    AnimationManager.animateCalendarTransition(el.calendarGrid);
  });

  el.calendarGrid.addEventListener("click", (e) => {
    const cell = e.target.closest(".cal-day-cell");
    if (!cell || cell.classList.contains("is-empty")) return;
    state.ui.calendarSelectedDate = cell.dataset.dateKey;
    renderCalendarGrid();
    renderCalendarSelectedList();
  });

  el.calChecklistList.addEventListener("click", (e) => handleChecklistItemClick(e));

  /* ============ 13. ADD FORM ============ */
  function renderCategoryPicker() {
    el.categoryPicker.innerHTML = state.categories
      .map((cat) => {
        const selected = state.ui.formSelectedCategoryId === cat.id ? " selected" : "";
        return `<button type="button" class="category-chip${selected}" data-category-id="${cat.id}">
          <span class="category-chip-dot" style="background:${cat.color}"></span>${escapeHTML(cat.name)}
        </button>`;
      })
      .join("");
  }

  function renderMonthdayPicker() {
    let html = "";
    for (let d = 1; d <= 31; d++) {
      const selected = state.ui.formSelectedMonthDays.has(d) ? " selected" : "";
      html += `<button type="button" class="monthday-btn${selected}" data-day="${d}">${d}</button>`;
    }
    el.monthdayPicker.innerHTML = html;
  }

  function renderWeekdayPickerState() {
    $$(".weekday-chip", el.weekdayPicker).forEach((btn) => {
      const day = Number(btn.dataset.day);
      btn.classList.toggle("selected", state.ui.formSelectedWeekdays.has(day));
    });
  }

  function setScheduleType(type) {
    state.ui.scheduleType = type;
    $$(".schedule-type-btn", el.addForm).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.scheduleType === type);
    });
    el.scheduleDetailOnce.hidden = type !== "once";
    el.scheduleDetailWeekly.hidden = type !== "weekly";
    el.scheduleDetailMonthly.hidden = type !== "monthly";
  }

  function resetAddForm() {
    state.ui.editingItemId = null;
    el.addPageTitle.textContent = "เพิ่มรายการ";
    el.cancelEditBtn.hidden = true;
    el.saveItemBtn.textContent = "บันทึก";
    el.itemNameInput.value = "";
    el.itemDescInput.value = "";
    el.onceDateInput.value = formatDateKey(todayDate());
    state.ui.formSelectedCategoryId = state.categories.length ? state.categories[0].id : null;
    state.ui.formSelectedWeekdays = new Set();
    state.ui.formSelectedMonthDays = new Set();
    setScheduleType("once");
    renderCategoryPicker();
    renderMonthdayPicker();
    renderWeekdayPickerState();
  }

  function openAddFormForEdit(itemId) {
    const item = state.items.find((it) => it.id === itemId);
    if (!item) return;
    state.ui.editingItemId = itemId;
    el.addPageTitle.textContent = "แก้ไขรายการ";
    el.cancelEditBtn.hidden = false;
    el.saveItemBtn.textContent = "บันทึกการแก้ไข";
    el.itemNameInput.value = item.name;
    el.itemDescInput.value = item.description || "";
    state.ui.formSelectedCategoryId = item.categoryId;

    state.ui.formSelectedWeekdays = new Set(item.schedule.type === "weekly" ? item.schedule.days : []);
    state.ui.formSelectedMonthDays = new Set(item.schedule.type === "monthly" ? item.schedule.datesOfMonth : []);
    el.onceDateInput.value = item.schedule.type === "once" ? item.schedule.date : formatDateKey(todayDate());

    setScheduleType(item.schedule.type);
    renderCategoryPicker();
    renderMonthdayPicker();
    renderWeekdayPickerState();

    switchPage("add", { forEdit: true });
  }

  $$(".schedule-type-btn", el.addForm).forEach((btn) => {
    btn.addEventListener("click", () => setScheduleType(btn.dataset.scheduleType));
  });

  el.categoryPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".category-chip");
    if (!chip) return;
    state.ui.formSelectedCategoryId = chip.dataset.categoryId;
    renderCategoryPicker();
  });

  el.weekdayPicker.addEventListener("click", (e) => {
    const chip = e.target.closest(".weekday-chip");
    if (!chip) return;
    const day = Number(chip.dataset.day);
    if (state.ui.formSelectedWeekdays.has(day)) {
      state.ui.formSelectedWeekdays.delete(day);
    } else {
      state.ui.formSelectedWeekdays.add(day);
    }
    renderWeekdayPickerState();
  });

  el.monthdayPicker.addEventListener("click", (e) => {
    const btn = e.target.closest(".monthday-btn");
    if (!btn) return;
    const day = Number(btn.dataset.day);
    if (state.ui.formSelectedMonthDays.has(day)) {
      state.ui.formSelectedMonthDays.delete(day);
    } else {
      state.ui.formSelectedMonthDays.add(day);
    }
    renderMonthdayPicker();
  });

  el.manageCategoryBtn.addEventListener("click", openCategoryModal);
  el.cancelEditBtn.addEventListener("click", () => resetAddForm());

  el.addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = el.itemNameInput.value.trim();
    if (!name) {
      toast("กรุณาระบุชื่อรายการ");
      return;
    }
    if (!state.ui.formSelectedCategoryId) {
      toast("กรุณาเลือกหมวดหมู่");
      return;
    }

    const type = state.ui.scheduleType;
    let schedule = { type };

    if (type === "once") {
      if (!el.onceDateInput.value) {
        toast("กรุณาเลือกวันที่");
        return;
      }
      schedule.date = el.onceDateInput.value;
    } else if (type === "weekly") {
      if (state.ui.formSelectedWeekdays.size === 0) {
        toast("กรุณาเลือกวันในสัปดาห์อย่างน้อย 1 วัน");
        return;
      }
      schedule.days = [...state.ui.formSelectedWeekdays];
    } else if (type === "monthly") {
      if (state.ui.formSelectedMonthDays.size === 0) {
        toast("กรุณาเลือกวันที่อย่างน้อย 1 วัน");
        return;
      }
      schedule.datesOfMonth = [...state.ui.formSelectedMonthDays];
    }

    if (state.ui.editingItemId) {
      const item = state.items.find((it) => it.id === state.ui.editingItemId);
      if (item) {
        item.name = name;
        item.categoryId = state.ui.formSelectedCategoryId;
        item.description = el.itemDescInput.value.trim();
        item.schedule = schedule;
      }
      toast("บันทึกการแก้ไขแล้ว");
    } else {
      state.items.push({
        id: generateId(),
        name,
        categoryId: state.ui.formSelectedCategoryId,
        description: el.itemDescInput.value.trim(),
        schedule,
        createdAt: Date.now(),
      });
      toast("เพิ่มรายการแล้ว");
    }

    persistItems();
    SoundManager.playSave();
    resetAddForm();
    switchPage("home");
  });

  function generateId() {
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function deleteItem(itemId) {
    state.items = state.items.filter((it) => it.id !== itemId);
    persistItems();
    // ลบข้อมูลการเช็กที่เกี่ยวข้องออกด้วย เพื่อไม่ให้ข้อมูลค้าง
    Object.keys(state.completions).forEach((dateKey) => {
      const list = state.completions[dateKey];
      const idx = list.indexOf(itemId);
      if (idx >= 0) {
        list.splice(idx, 1);
        if (list.length === 0) delete state.completions[dateKey];
      }
    });
    persistCompletions();
    recalcStreak();
    SoundManager.playDelete();
    toast("ลบรายการแล้ว");
    hideConfirm();

    if (state.ui.currentPage === "home") renderHome();
    if (state.ui.currentPage === "calendar") { renderCalendarGrid(); renderCalendarSelectedList(); }
    if (state.ui.currentPage === "stats") renderStatsPage();
  }

  /* ============ 14. CATEGORY MODAL ============ */
  function renderCategoryManageList() {
    el.categoryManageList.innerHTML = state.categories
      .map(
        (cat) => `
      <li class="category-manage-item" data-category-id="${cat.id}">
        <input type="color" class="cat-manage-color" value="${cat.color}" data-action="color">
        <input type="text" class="cat-manage-name" value="${escapeHTML(cat.name)}" data-action="rename" maxlength="20">
        <button type="button" class="cat-manage-delete" data-action="delete-category">🗑️</button>
      </li>`
      )
      .join("");
  }

  function openCategoryModal() {
    renderCategoryManageList();
    AnimationManager.openModal(el.categoryModalOverlay);
    SoundManager.playPopup();
  }

  function closeCategoryModal() {
    AnimationManager.closeModal(el.categoryModalOverlay);
    SoundManager.playPopupClose();
    // รีเฟรชหน้าที่เกี่ยวข้องกับหมวดหมู่หลังปิด modal
    if (state.ui.currentPage === "home") renderHome();
    if (state.ui.currentPage === "add") { renderCategoryPicker(); }
    if (state.ui.currentPage === "stats") renderStatsPage();
  }

  el.settingsManageCategoryBtn.addEventListener("click", openCategoryModal);
  el.closeCategoryModalBtn.addEventListener("click", closeCategoryModal);
  el.categoryModalOverlay.addEventListener("click", (e) => {
    if (e.target === el.categoryModalOverlay) closeCategoryModal();
  });

  el.categoryManageList.addEventListener("input", (e) => {
    const li = e.target.closest(".category-manage-item");
    if (!li) return;
    const cat = getCategoryById(li.dataset.categoryId);
    if (!cat) return;
    const action = e.target.dataset.action;
    if (action === "rename") {
      cat.name = e.target.value;
      persistCategories();
    } else if (action === "color") {
      cat.color = e.target.value;
      persistCategories();
    }
  });

  el.categoryManageList.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="delete-category"]');
    if (!btn) return;
    const li = e.target.closest(".category-manage-item");
    const categoryId = li.dataset.categoryId;
    const cat = getCategoryById(categoryId);
    showConfirm("ลบหมวดหมู่", `ต้องการลบหมวดหมู่ "${cat ? cat.name : ""}" ใช่หรือไม่?`, () => {
      state.categories = state.categories.filter((c) => c.id !== categoryId);
      persistCategories();
      // รายการที่ใช้หมวดนี้จะกลายเป็น "ไม่มีหมวดหมู่" โดยอัตโนมัติ (categoryId ไม่ match กับหมวดใดแล้ว)
      renderCategoryManageList();
      hideConfirm();
      toast("ลบหมวดหมู่แล้ว");
    });
  });

  el.addCategoryBtn.addEventListener("click", () => {
    const name = el.newCategoryNameInput.value.trim();
    if (!name) {
      toast("กรุณาระบุชื่อหมวดหมู่");
      return;
    }
    state.categories.push({
      id: generateId(),
      name,
      color: el.newCategoryColorInput.value,
    });
    persistCategories();
    el.newCategoryNameInput.value = "";
    renderCategoryManageList();
    SoundManager.playSave();
    toast("เพิ่มหมวดหมู่แล้ว");
  });

  /* ============ 15. CONFIRM DIALOG WIRING ============ */
  el.confirmDialogCancelBtn.addEventListener("click", hideConfirm);
  el.confirmDialogOkBtn.addEventListener("click", () => {
    const cb = state.ui.pendingConfirmCallback;
    state.ui.pendingConfirmCallback = null;
    if (typeof cb === "function") cb();
  });
  el.confirmDialogOverlay.addEventListener("click", (e) => {
    if (e.target === el.confirmDialogOverlay) hideConfirm();
  });

  /* ============ 16. STATISTICS PAGE ============ */
  function computeMonthStats(year, month) {
    const today = todayDate();
    const totalDays = daysInMonth(year, month);
    let total = 0;
    let done = 0;
    const categoryMap = new Map(); // categoryId -> {total, done}

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day);
      if (date > today) continue; // ยังไม่ถึงวันนั้น ไม่นับ
      const dateKey = formatDateKey(date);
      const items = getItemsForDate(date);
      items.forEach((item) => {
        total++;
        const isDone = isItemCompletedOn(item.id, dateKey);
        if (isDone) done++;

        const key = item.categoryId || "__none__";
        if (!categoryMap.has(key)) categoryMap.set(key, { total: 0, done: 0 });
        const entry = categoryMap.get(key);
        entry.total++;
        if (isDone) entry.done++;
      });
    }

    const categoryBreakdown = [...categoryMap.entries()]
      .map(([categoryId, stats]) => {
        const cat = getCategoryById(categoryId);
        return {
          categoryId,
          name: cat ? cat.name : "ไม่มีหมวดหมู่",
          color: cat ? cat.color : "#B0B8C4",
          total: stats.total,
          done: stats.done,
          pending: stats.total - stats.done,
        };
      })
      .sort((a, b) => b.total - a.total);

    return { total, done, pending: total - done, categoryBreakdown };
  }

  function renderStatsChart(stats) {
    const type = state.ui.statsChartType;
    const svg = el.statsChartSvg;
    const data = stats.categoryBreakdown.filter((c) => c.total > 0);

    if (data.length === 0) {
      svg.innerHTML = `<circle cx="100" cy="100" r="80" fill="none" stroke="#E7EEF6" stroke-width="24"/>`;
      el.statsChartLegend.innerHTML = `<span class="legend-item">ไม่มีข้อมูลในเดือนนี้</span>`;
      return;
    }

    if (type === "pie") {
      const radius = 80;
      const circumference = 2 * Math.PI * radius;
      let offsetAcc = 0;
      const totalAll = data.reduce((sum, c) => sum + c.total, 0);
      const circles = data
        .map((c) => {
          const fraction = c.total / totalAll;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const circle = `<circle cx="100" cy="100" r="${radius}" fill="none" stroke="${c.color}" stroke-width="26"
            stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offsetAcc}" transform="rotate(-90 100 100)" stroke-linecap="butt"/>`;
          offsetAcc += dash;
          return circle;
        })
        .join("");
      svg.setAttribute("viewBox", "0 0 200 200");
      svg.innerHTML = circles + `<circle cx="100" cy="100" r="54" fill="var(--color-surface)"/>
        <text x="100" y="95" text-anchor="middle" font-size="26" font-weight="800" fill="var(--color-text)">${totalAll}</text>
        <text x="100" y="116" text-anchor="middle" font-size="12" fill="var(--color-text-secondary)">รายการ</text>`;
    } else {
      const maxVal = Math.max(...data.slice(0, 6).map((c) => c.total), 1);
      const barsData = data.slice(0, 6);
      const barWidth = 24;
      const gap = (200 - barsData.length * barWidth) / (barsData.length + 1);
      const chartHeight = 150;
      let bars = "";
      barsData.forEach((c, i) => {
        const barHeight = (c.total / maxVal) * chartHeight;
        const x = gap + i * (barWidth + gap);
        const y = 170 - barHeight;
        bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="${c.color}"/>`;
        bars += `<text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--color-text)">${c.total}</text>`;
      });
      bars += `<line x1="0" y1="170" x2="200" y2="170" stroke="var(--color-border)" stroke-width="1.5"/>`;
      svg.setAttribute("viewBox", "0 0 200 190");
      svg.innerHTML = bars;
    }

    el.statsChartLegend.innerHTML = data
      .map((c) => `<span class="legend-item"><span class="legend-dot" style="background:${c.color}"></span>${escapeHTML(c.name)}</span>`)
      .join("");
  }

  function renderStatsCategoryList(stats) {
    if (stats.categoryBreakdown.length === 0) {
      el.statsCategoryList.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><p class="empty-state-title">ยังไม่มีข้อมูลในเดือนนี้</p></div>`;
      return;
    }
    el.statsCategoryList.innerHTML = stats.categoryBreakdown
      .map((c) => {
        const percent = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
        return `
        <div class="stats-category-item">
          <span class="stats-cat-dot" style="background:${c.color}"></span>
          <div class="stats-cat-info">
            <p class="stats-cat-name">${escapeHTML(c.name)}</p>
            <div class="stats-cat-track"><div class="stats-cat-fill" style="width:${percent}%;background:${c.color}"></div></div>
          </div>
          <span class="stats-cat-count">${c.done}/${c.total}</span>
        </div>`;
      })
      .join("");
  }

  function renderStatsPage() {
    el.statsMonthLabel.textContent = `${THAI_MONTHS[state.ui.statsMonth]} ${toBuddhistYear(state.ui.statsYear)}`;
    const stats = computeMonthStats(state.ui.statsYear, state.ui.statsMonth);
    el.statsTotalValue.textContent = stats.total;
    el.statsDoneValue.textContent = stats.done;
    el.statsPendingValue.textContent = stats.pending;

    $$(".chart-toggle-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.chartType === state.ui.statsChartType));
    renderStatsChart(stats);
    renderStatsCategoryList(stats);
  }

  el.statsPrevBtn.addEventListener("click", () => {
    state.ui.statsMonth--;
    if (state.ui.statsMonth < 0) {
      state.ui.statsMonth = 11;
      state.ui.statsYear--;
    }
    renderStatsPage();
  });

  el.statsNextBtn.addEventListener("click", () => {
    state.ui.statsMonth++;
    if (state.ui.statsMonth > 11) {
      state.ui.statsMonth = 0;
      state.ui.statsYear++;
    }
    renderStatsPage();
  });

  $(".chart-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".chart-toggle-btn");
    if (!btn) return;
    state.ui.statsChartType = btn.dataset.chartType;
    renderStatsPage();
  });

  /* ============ 17. SETTINGS PAGE ============ */
  function renderSettingsPage() {
    $$(".segmented-btn", el.settingsChartTypeSeg).forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.chartType === state.settings.chartType)
    );
    el.settingsSoundToggle.checked = state.settings.sound;
  }

  el.settingsChartTypeSeg.addEventListener("click", (e) => {
    const btn = e.target.closest(".segmented-btn");
    if (!btn) return;
    state.settings.chartType = btn.dataset.chartType;
    state.ui.statsChartType = btn.dataset.chartType;
    persistSettings();
    renderSettingsPage();
  });

  el.settingsManageCategoryBtn.addEventListener("click", openCategoryModal);

  el.settingsSoundToggle.addEventListener("change", (e) => {
    state.settings.sound = e.target.checked;
    SoundManager.setEnabled(state.settings.sound);
    persistSettings();
    if (state.settings.sound) SoundManager.playPopup();
  });

  el.settingsClearDataBtn.addEventListener("click", () => {
    showConfirm("ล้างข้อมูลทั้งหมด", "การกระทำนี้จะลบรายการ หมวดหมู่ และสถิติทั้งหมดอย่างถาวร ต้องการดำเนินการต่อหรือไม่?", () => {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
      hideConfirm();
      toast("ล้างข้อมูลเรียบร้อย");
      setTimeout(() => location.reload(), 600);
    });
  });

  /* ============ 18. INIT ============ */
  function initFormDefaults() {
    el.onceDateInput.value = formatDateKey(todayDate());
  }

  function init() {
    loadAllData();
    SoundManager.setEnabled(state.settings.sound);

    const today = todayDate();
    state.ui.calendarYear = today.getFullYear();
    state.ui.calendarMonth = today.getMonth();
    state.ui.calendarSelectedDate = formatDateKey(today);
    state.ui.statsYear = today.getFullYear();
    state.ui.statsMonth = today.getMonth();
    state.ui.statsChartType = state.settings.chartType;
    state.ui.formSelectedCategoryId = state.categories.length ? state.categories[0].id : null;

    recalcStreak();
    initFormDefaults();

    renderHome();
    switchPage("home", { silent: true });

    // ลงทะเบียน Service Worker สำหรับ PWA / Offline
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch((err) => {
          console.warn("Service worker registration failed:", err);
        });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
