/**
 * PSD_eNGINNo FIXTAB Analysis V1.0 — Backend (Google Apps Script)
 * -----------------------------------------------------------------
 * วิธีติดตั้ง (สรุปสั้น เต็มๆ ดูใน README.md):
 * 1. สร้าง Google Sheet ใหม่ 1 ไฟล์ ตั้งชื่อ "FIXTAB_Analysis_DB"
 * 2. เปิด Extensions > Apps Script วางโค้ดไฟล์นี้ทับของเดิมทั้งหมด
 * 3. รันฟังก์ชัน setup() หนึ่งครั้ง (เพื่อสร้างชีต Users + Uploads + สร้าง admin เริ่มต้น)
 * 4. Deploy > New deployment > Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. คัดลอก Web App URL ไปใส่ใน js/config.js ของฝั่ง Frontend (ตัวแปร API_URL)
 */

const USERS_SHEET = 'Users';
const UPLOADS_SHEET = 'Uploads';

// ---------- Setup (รันครั้งเดียวตอนติดตั้ง) ----------
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let users = ss.getSheetByName(USERS_SHEET);
  if (!users) users = ss.insertSheet(USERS_SHEET);
  users.clear();
  users.appendRow(['Username', 'PasswordHash', 'Role', 'Status', 'CreatedAt']);
  users.appendRow(['admin', hashPassword_('fixtab2026'), 'admin', 'approved', new Date()]);

  let uploads = ss.getSheetByName(UPLOADS_SHEET);
  if (!uploads) uploads = ss.insertSheet(UPLOADS_SHEET);
  uploads.clear();
  uploads.appendRow(['Timestamp', 'Username', 'FileName', 'FileType', 'RowCount', 'Note']);

  SpreadsheetApp.flush();
  Logger.log('Setup complete. Default admin: admin / fixtab2026');
}

// ---------- Entry points ----------
function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'listUsers') return json_(listUsers_());
    if (action === 'listUploads') return json_(listUploads_());
    return json_({ ok: false, error: 'Unknown GET action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  let body = {};
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Invalid JSON body' });
  }
  const action = body.action;
  try {
    if (action === 'login') return json_(login_(body.username, body.password));
    if (action === 'register') return json_(register_(body.username, body.password));
    if (action === 'approveUser') return json_(setUserStatus_(body.username, 'approved'));
    if (action === 'rejectUser') return json_(setUserStatus_(body.username, 'rejected'));
    if (action === 'revokeUser') return json_(setUserStatus_(body.username, 'revoked'));
    if (action === 'logUpload') return json_(logUpload_(body.username, body.fileName, body.fileType, body.rowCount, body.note));
    return json_({ ok: false, error: 'Unknown POST action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---------- Auth ----------
function login_(username, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const [u, hash, role, status] = data[i];
    if (u === username) {
      if (hash !== hashPassword_(password)) return { ok: false, error: 'รหัสผ่านไม่ถูกต้อง' };
      if (status !== 'approved') return { ok: false, error: 'บัญชียังไม่ได้รับการอนุมัติ (สถานะ: ' + status + ')' };
      return { ok: true, username: u, role: role };
    }
  }
  return { ok: false, error: 'ไม่พบชื่อผู้ใช้นี้' };
}

function register_(username, password) {
  if (!username || !password) return { ok: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) return { ok: false, error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' };
  }
  sheet.appendRow([username, hashPassword_(password), 'user', 'pending', new Date()]);
  return { ok: true, message: 'สมัครสำเร็จ รอผู้ดูแลระบบอนุมัติ' };
}

function setUserStatus_(username, status) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      sheet.getRange(i + 1, 4).setValue(status);
      return { ok: true, username: username, status: status };
    }
  }
  return { ok: false, error: 'ไม่พบผู้ใช้นี้' };
}

function listUsers_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    rows.push({ username: data[i][0], role: data[i][2], status: data[i][3], createdAt: data[i][4] });
  }
  return { ok: true, users: rows };
}

// ---------- Upload log (บันทึกว่าใคร import ไฟล์อะไรเมื่อไหร่) ----------
function logUpload_(username, fileName, fileType, rowCount, note) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UPLOADS_SHEET);
  sheet.appendRow([new Date(), username || 'unknown', fileName || '', fileType || '', rowCount || 0, note || '']);
  return { ok: true };
}

function listUploads_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(UPLOADS_SHEET);
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    rows.push({ timestamp: data[i][0], username: data[i][1], fileName: data[i][2], fileType: data[i][3], rowCount: data[i][4], note: data[i][5] });
  }
  return { ok: true, uploads: rows };
}

// ---------- Utils ----------
function hashPassword_(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
