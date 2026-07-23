// ==========================================================================
// Shared shell: sidebar, topbar, และตัวโหลดธีมจาก Settings
// ==========================================================================

const NAV_ITEMS = [
  { href: "operations.html", label: "Work Request", icon: "🛠️" },
  { href: "dashboard.html", label: "CAPEX/OPEX Analysis", icon: "📊" },
  { href: "import.html", label: "นำเข้าข้อมูล", icon: "📥" },
  { href: "admin.html", label: "Admin Management", icon: "🛡️", adminOnly: true },
  { href: "settings.html", label: "ตั้งค่า", icon: "⚙️" },
];

function renderShell(activeHref) {
  const session = requireAuth();
  if (!session) return;

  const shellHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="tag">${APP_NAME}</div>
          <h1>FIXTAB <span style="color:var(--accent)">${APP_VERSION}</span></h1>
        </div>
        <nav class="sidebar-nav" id="sidebarNav"></nav>
        <div class="sidebar-foot">
          <div class="user-chip">
            <span>👤 ${session.username} <span class="mono" style="color:var(--text-muted)">(${session.role})</span></span>
          </div>
          <button class="btn secondary small" style="margin-top:10px;width:100%" onclick="doLogout()">ออกจากระบบ</button>
        </div>
      </aside>
      <main class="main" id="mainContent"></main>
    </div>
  `;
  document.getElementById("app").innerHTML = shellHTML;

  const nav = document.getElementById("sidebarNav");
  NAV_ITEMS.forEach((item) => {
    if (item.adminOnly && session.role !== "admin") return;
    const a = document.createElement("a");
    a.href = item.href;
    a.className = item.href === activeHref ? "active" : "";
    a.innerHTML = `<span class="dot"></span> ${item.icon} ${item.label}`;
    nav.appendChild(a);
  });

  applyTheme();
}

// ---------- Theme ----------
const THEME_KEY = "fixtab_theme";
const DEFAULT_THEME = {
  bg: "#0F1720",
  surface: "#17212B",
  accent: "#E8A33D",
  accent2: "#3FA796",
  danger: "#D9685F",
  fontScale: 1,
};

function getTheme() {
  const raw = localStorage.getItem(THEME_KEY);
  if (!raw) return { ...DEFAULT_THEME };
  try { return { ...DEFAULT_THEME, ...JSON.parse(raw) }; } catch { return { ...DEFAULT_THEME }; }
}

function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  applyTheme();
}

function resetTheme() {
  localStorage.removeItem(THEME_KEY);
  applyTheme();
}

function applyTheme() {
  const t = getTheme();
  const root = document.documentElement.style;
  root.setProperty("--bg", t.bg);
  root.setProperty("--surface", t.surface);
  root.setProperty("--accent", t.accent);
  root.setProperty("--accent-2", t.accent2);
  root.setProperty("--danger", t.danger);
  document.body.style.fontSize = `${15 * t.fontScale}px`;
}

// apply theme immediately on every page load (before shell renders too)
applyTheme();

// ---------- SLA Target (Maintainability) — ใช้ร่วมกันระหว่างหน้า Work Request และ ตั้งค่า ----------
const SLA_KEY = "fixtab_sla_settings";
const DEFAULT_SLA_SETTINGS = { High: 4, Medium: 24, Low: 72, Default: 24 };

function getSlaSettings() {
  const raw = localStorage.getItem(SLA_KEY);
  if (!raw) return { ...DEFAULT_SLA_SETTINGS };
  try { return { ...DEFAULT_SLA_SETTINGS, ...JSON.parse(raw) }; } catch { return { ...DEFAULT_SLA_SETTINGS }; }
}

function saveSlaSettings(settings) {
  localStorage.setItem(SLA_KEY, JSON.stringify(settings));
}

function resetSlaSettings() {
  localStorage.removeItem(SLA_KEY);
}

// ---------- Visibility (ซ่อน/แสดงส่วนต่างๆ) — ใช้ร่วมกันทุกหน้า ----------
const VISIBILITY_KEY = "fixtab_visibility_settings";

function getVisibilitySettings() {
  const raw = localStorage.getItem(VISIBILITY_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function saveVisibilitySettings(settings) {
  localStorage.setItem(VISIBILITY_KEY, JSON.stringify(settings));
}

function resetVisibilitySettings() {
  localStorage.removeItem(VISIBILITY_KEY);
}

// เช็คว่า section นี้ถูกซ่อนไว้ไหม (default = แสดง ถ้ายังไม่เคยตั้งค่า)
function isSectionVisible(pageKey, sectionId) {
  const settings = getVisibilitySettings();
  if (!settings[pageKey]) return true;
  return settings[pageKey][sectionId] !== false;
}

// รายการ section ที่ซ่อน/แสดงได้ต่อหน้า (ใช้ทั้งในหน้า ตั้งค่า และหน้าที่เกี่ยวข้อง)
const PAGE_SECTIONS = {
  workrequest: {
    label: "Work Request",
    sections: [
      { id: "kpi", label: "KPI หลัก (WR ทั้งหมด / MTTR / Maintainability / Priority สูง)" },
      { id: "statuspct", label: "สัดส่วนสถานะงาน (แถบเปอร์เซ็นต์)" },
      { id: "joblist", label: "ตารางรายละเอียดงาน" },
      { id: "status", label: "สถานะงาน (Status Ticket)" },
      { id: "priority", label: "ระดับความสำคัญ (Priority)" },
      { id: "issuetype", label: "ประเภทปัญหา (Issue Type)" },
      { id: "tickettype", label: "ประเภทงาน (Ticket Type)" },
      { id: "building", label: "อาคาร (จับคู่ Location)" },
      { id: "area", label: "พื้นที่ (จับคู่ Area)" },
      { id: "costtype", label: "ค่าใช้จ่ายรวม แยกตามประเภทปัญหา" },
      { id: "anbucket", label: "การกระจายจำนวนครั้งที่เสียซ้ำ" },
      { id: "costsummary", label: "ค่าใช้จ่ายรวม แยกตามหมวดต้นทุน" },
      { id: "techperf", label: "ผลงานรายช่าง" },
      { id: "repeat", label: "จุด/ประเภทงานที่เสียซ้ำบ่อย" },
    ],
  },
  capexopex: {
    label: "CAPEX/OPEX Analysis",
    sections: [
      { id: "kpi", label: "KPI หลัก 4 ช่อง" },
      { id: "summary4", label: "สรุปค่าใช้จ่ายจากไฟล์ทั้ง 4" },
      { id: "povalue", label: "มูลค่า PR/PO รวม (มี Ticket / ไม่มี Ticket)" },
      { id: "budgetoverview", label: "งบประมาณ vs ยอดใช้จริง (Budget Utilization)" },
      { id: "postatus", label: "มูลค่า PR/PO แยกตามสถานะ Ticket" },
      { id: "pocompany", label: "มูลค่า PR/PO แยกตามบริษัท" },
      { id: "pobranch", label: "มูลค่า PR/PO แยกตามสาขา" },
      { id: "poproduct", label: "มูลค่า PR/PO แยกตามอุปกรณ์ (Product)" },
      { id: "classification", label: "การจำแนกลักษณะ Ticket ที่ซ่อมเสร็จ" },
      { id: "categorychart", label: "ค่าซ่อมต่อครั้ง แยกตามหมวดอุปกรณ์" },
      { id: "threshold", label: "เกณฑ์ CAPEX vs OPEX รายหมวดอุปกรณ์" },
    ],
  },
};

function fmtNumber(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: 0 });
}
