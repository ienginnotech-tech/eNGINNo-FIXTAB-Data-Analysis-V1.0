// ==========================================================================
// Auth: เรียก Apps Script backend สำหรับ login/register, เก็บ session ใน localStorage
// ==========================================================================

const SESSION_KEY = "fixtab_session";

async function apiCall(action, payload = {}) {
  if (!API_URL || API_URL.indexOf("PASTE_YOUR") === 0) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่า API_URL ใน js/config.js — ดูขั้นตอนใน README.md" };
  }
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // หลีกเลี่ยง CORS preflight ของ Apps Script
      body: JSON.stringify({ action, ...payload }),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: "เชื่อมต่อ Backend ไม่สำเร็จ: " + err.message };
  }
}

async function apiGet(action, params = {}) {
  if (!API_URL || API_URL.indexOf("PASTE_YOUR") === 0) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่า API_URL ใน js/config.js" };
  }
  const qs = new URLSearchParams({ action, ...params }).toString();
  try {
    const res = await fetch(`${API_URL}?${qs}`);
    return await res.json();
  } catch (err) {
    return { ok: false, error: "เชื่อมต่อ Backend ไม่สำเร็จ: " + err.message };
  }
}

function saveSession(username, role) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username, role, ts: Date.now() }));
}

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function requireAuth() {
  const s = getSession();
  if (!s) {
    window.location.href = "index.html";
    return null;
  }
  return s;
}

function requireAdmin() {
  const s = requireAuth();
  if (s && s.role !== "admin") {
    alert("หน้านี้สำหรับผู้ดูแลระบบเท่านั้น");
    window.location.href = "dashboard.html";
    return null;
  }
  return s;
}

async function doLogin(username, password) {
  const res = await apiCall("login", { username, password });
  if (res.ok) saveSession(res.username, res.role);
  return res;
}

async function doRegister(username, password) {
  return await apiCall("register", { username, password });
}

function doLogout() {
  clearSession();
  window.location.href = "index.html";
}
