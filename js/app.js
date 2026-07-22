// ==========================================================================
// Shared shell: sidebar, topbar, และตัวโหลดธีมจาก Settings
// ==========================================================================

const NAV_ITEMS = [
  { href: "operations.html", label: "Work Request", icon: "🛠️" },
  { href: "dashboard.html", label: "Data Analysis", icon: "📊" },
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

function fmtNumber(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: 0 });
}
