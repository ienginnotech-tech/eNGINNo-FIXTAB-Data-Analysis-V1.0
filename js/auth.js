// ==========================================================================
// Auth V2: Login ด้วยอีเมล + OTP + API KEY, Session เป็น token จาก Backend
// Role: admin / manager / user (ตรวจซ้ำที่ฝั่ง Backend ทุกครั้ง ฝั่งนี้เป็นแค่การซ่อนเมนู)
// ==========================================================================

const SESSION_KEY = "fixtab_session";
const API_KEY_STORE = "fixtab_api_key";

function getApiKey() { try { return localStorage.getItem(API_KEY_STORE) || ""; } catch { return ""; } }
function setApiKey(k) { try { localStorage.setItem(API_KEY_STORE, k); } catch {} }

async function apiCall(action, payload = {}) {
  if (!API_URL || API_URL.indexOf("PASTE_YOUR") === 0) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่า API_URL ใน js/config.js" };
  }
  const s = getSession();
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // หลีกเลี่ยง CORS preflight ของ Apps Script
      body: JSON.stringify({ action, key: getApiKey(), token: s ? s.token : "", ...payload }),
    });
    const out = await res.json();
    if (out && out.code === "AUTH" && s) {           // session หมดอายุ
      clearSession();
      alert(out.error || "Session หมดอายุ");
      window.location.href = "index.html";
    }
    return out;
  } catch (err) {
    return { ok: false, error: "เชื่อมต่อ Backend ไม่สำเร็จ: " + err.message };
  }
}

// เก็บไว้ให้โค้ดเก่าที่ยังเรียก apiGet ไม่พัง (V2 ใช้ POST ทั้งหมดเพื่อไม่ให้ KEY ไปอยู่ใน URL)
async function apiGet(action, params = {}) { return apiCall(action, params); }

function saveSession(s) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    username: s.email, email: s.email, name: s.name, role: s.role, token: s.token, exp: s.exp, ts: Date.now(),
  }));
}

function getSession() {
  let raw = null;
  try { raw = localStorage.getItem(SESSION_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s.token || (s.exp && s.exp < Date.now())) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}

function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }

function requireAuth() {
  const s = getSession();
  if (!s) { window.location.href = "index.html"; return null; }
  return s;
}

function requireAdmin() {
  const s = requireAuth();
  if (s && s.role !== "admin") {
    alert("หน้านี้สำหรับผู้ดูแลระบบ (Admin) เท่านั้น");
    window.location.href = "operations.html";
    return null;
  }
  return s;
}

// manager + admin นำเข้า/ล้างข้อมูลกลางได้
function canUpload() { const s = getSession(); return !!s && (s.role === "admin" || s.role === "manager"); }

function requireUploader() {
  const s = requireAuth();
  if (s && s.role !== "admin" && s.role !== "manager") {
    alert("หน้านี้สำหรับผู้นำเข้าข้อมูล (Manager/Admin) เท่านั้น — ผู้ใช้ทั่วไปดูข้อมูลได้อย่างเดียว");
    window.location.href = "operations.html";
    return null;
  }
  return s;
}

// ---- Login flow: requestOtp -> verifyOtp ----
async function doRequestOtp(email, key) {
  setApiKey(key);
  return await apiCall("requestOtp", { email, key });
}

async function doVerifyOtp(email, code, key) {
  setApiKey(key);
  const res = await apiCall("verifyOtp", { email, code, key });
  if (res.ok) saveSession(res);
  return res;
}

async function doRegister(email, name, key) {
  setApiKey(key);
  return await apiCall("register", { email, name, key });
}

function doLogout() { clearSession(); window.location.href = "index.html"; }
