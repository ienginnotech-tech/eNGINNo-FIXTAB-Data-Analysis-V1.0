/**
 * PSD_eNGINNo FIXTAB Analysis V2.0 — Backend (Google Apps Script)
 * -----------------------------------------------------------------
 * V2: ข้อมูลกลาง (ทุกคนเห็นชุดเดียวกัน) + Login ด้วยอีเมล + OTP + อนุมัติ + Role + API KEY
 *
 * Role:  admin   = ทำได้ทุกอย่าง (จัดการผู้ใช้ + นำเข้าข้อมูล + ดูข้อมูล)
 *        manager = นำเข้า/ล้างข้อมูลกลาง + ดูข้อมูล
 *        user    = ดูข้อมูลอย่างเดียว
 *
 * ขั้นตอนติดตั้งอยู่ใน README_V2.md  (สรุป)
 *  1. วางโค้ดนี้ทับ Code.gs เดิมทั้งหมด
 *  2. รัน setup() หนึ่งครั้ง (อนุญาตสิทธิ์ Sheet + Gmail) -> ดู API KEY ใน Execution log
 *  3. Deploy > Manage deployments > ดินสอ > New version (URL เดิม)
 *  KEY เปลี่ยนได้ภายหลังด้วย changeApiKey()
 */

const SHEET_ID = '1iY61l-8g-FvQHZm-9gsG6HC9c91RD3cf4wW-_V-pZoE';

const MEMBERS_SHEET = 'Members';
const UPLOADS_SHEET = 'Uploads';
const STORE_SHEETS = ['StoreA', 'StoreB'];

// ผู้ใช้เริ่มต้น (สร้างตอน setup)
const SEED_ADMIN = 'kittananonsee@gmail.com';
const SEED_MANAGERS = ['Chontanut.R@bhirajburi.co.th'];

// ถ้าอยากเปลี่ยน KEY ตอนรัน changeApiKey() ให้แก้ค่านี้ก่อนรัน แล้วลบค่าออกหลังใช้
const NEW_API_KEY = '';

const OTP_TTL_MIN = 10;      // OTP หมดอายุ (นาที)
const OTP_RESEND_SEC = 45;   // ขอ OTP ซ้ำได้ทุกกี่วินาที
const OTP_MAX_FAILS = 5;     // กรอกผิดได้กี่ครั้ง
const SESSION_HOURS = 12;    // Session อยู่ได้กี่ชั่วโมง
const CELL_LIMIT = 40000;    // ตัวอักษรต่อเซลล์ (Sheet จำกัด 50,000)

const COL = { EMAIL: 0, NAME: 1, ROLE: 2, STATUS: 3, CREATED: 4, OTP_HASH: 5, OTP_EXP: 6, OTP_FAILS: 7, OTP_SENT: 8, LAST_LOGIN: 9 };
const MEMBER_HEADERS = ['Email', 'Name', 'Role', 'Status', 'CreatedAt', 'OtpHash', 'OtpExpiry', 'OtpFails', 'OtpSentAt', 'LastLogin'];

// ---------------------------------------------------------------- helpers
function getDB_() { return SpreadsheetApp.openById(SHEET_ID); }
function props_() { return PropertiesService.getScriptProperties(); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function norm_(e) { return String(e || '').trim().toLowerCase(); }
function now_() { return new Date().getTime(); }

function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function randomKey_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 24).toUpperCase();
}

// ---------------------------------------------------------------- setup
function setup() {
  const ss = getDB_();
  const p = props_();

  let m = ss.getSheetByName(MEMBERS_SHEET);
  if (!m) {
    m = ss.insertSheet(MEMBERS_SHEET);
    m.appendRow(MEMBER_HEADERS);
    m.appendRow([SEED_ADMIN.toLowerCase(), 'Kittanan (Admin)', 'admin', 'approved', new Date(), '', '', 0, '', '']);
    SEED_MANAGERS.forEach(function (e) {
      m.appendRow([e.toLowerCase(), 'Maintainer', 'manager', 'approved', new Date(), '', '', 0, '', '']);
    });
  }

  let u = ss.getSheetByName(UPLOADS_SHEET);
  if (!u) {
    u = ss.insertSheet(UPLOADS_SHEET);
    u.appendRow(['Timestamp', 'Username', 'FileName', 'FileType', 'RowCount', 'Note']);
  }

  STORE_SHEETS.forEach(function (n) { if (!ss.getSheetByName(n)) ss.insertSheet(n); });

  if (!p.getProperty('API_KEY')) p.setProperty('API_KEY', randomKey_());
  if (!p.getProperty('TOKEN_SECRET')) p.setProperty('TOKEN_SECRET', randomKey_() + randomKey_());
  if (!p.getProperty('ACTIVE_STORE')) p.setProperty('ACTIVE_STORE', '');

  SpreadsheetApp.flush();
  Logger.log('=== SETUP เรียบร้อย ===');
  Logger.log('API KEY (ให้ผู้ใช้ทุกคน): ' + p.getProperty('API_KEY'));
  Logger.log('Admin: ' + SEED_ADMIN + ' | Manager: ' + SEED_MANAGERS.join(', '));
}

function showApiKey() { Logger.log('API KEY: ' + props_().getProperty('API_KEY')); }

function changeApiKey() {
  const k = NEW_API_KEY || randomKey_();
  props_().setProperty('API_KEY', k);
  Logger.log('API KEY ใหม่: ' + k + '  (ต้องแจ้งผู้ใช้ทุกคนให้ใส่ KEY ใหม่)');
}

// ---------------------------------------------------------------- entry points
function doGet() { return json_({ ok: true, service: 'FIXTAB Analysis API V2' }); }

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Invalid JSON' }); }
  try {
    if (!b.key || b.key !== props_().getProperty('API_KEY')) {
      return json_({ ok: false, code: 'KEY', error: 'KEY ไม่ถูกต้อง' });
    }
    const a = b.action;

    // ---- public (ต้องมี KEY อย่างเดียว) ----
    if (a === 'register') return json_(register_(b.email, b.name));
    if (a === 'requestOtp') return json_(requestOtp_(b.email));
    if (a === 'verifyOtp') return json_(verifyOtp_(b.email, b.code));

    // ---- ต้องมี token ----
    const me = auth_(b.token);
    if (!me) return json_({ ok: false, code: 'AUTH', error: 'Session หมดอายุ กรุณาเข้าสู่ระบบใหม่' });

    if (a === 'me') return json_({ ok: true, email: me.email, name: me.name, role: me.role });
    if (a === 'dataInfo') return json_(dataInfo_());
    if (a === 'loadData') return json_(loadData_(b.offset, b.limit));

    // ---- manager / admin ----
    if (a === 'saveChunk' || a === 'commitData' || a === 'clearData' || a === 'logUpload') {
      if (me.role !== 'admin' && me.role !== 'manager') return json_({ ok: false, error: 'สิทธิ์ไม่เพียงพอ (ต้องเป็น Manager หรือ Admin)' });
      if (a === 'logUpload') return json_(logUpload_(me.email, b.fileName, b.fileType, b.rowCount, b.note));
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        if (a === 'saveChunk') return json_(saveChunk_(b.seq, b.text));
        if (a === 'commitData') return json_(commitData_(me, b.rows));
        return json_(clearData_(me));
      } finally { lock.releaseLock(); }
    }

    // ---- admin ----
    if (me.role !== 'admin') return json_({ ok: false, error: 'สำหรับ Admin เท่านั้น' });
    if (a === 'listUsers') return json_(listUsers_());
    if (a === 'listUploads') return json_(listUploads_());
    if (a === 'setStatus') return json_(setStatus_(me, b.email, b.status));
    if (a === 'setRole') return json_(setRole_(me, b.email, b.role));
    if (a === 'addUser') return json_(addUser_(b.email, b.name, b.role));
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---------------------------------------------------------------- members
function members_() { return getDB_().getSheetByName(MEMBERS_SHEET); }

function findMember_(email) {
  const sh = members_();
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (norm_(data[i][COL.EMAIL]) === email) return { row: i + 1, v: data[i], sh: sh };
  }
  return null;
}

function register_(email, name) {
  email = norm_(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'รูปแบบอีเมลไม่ถูกต้อง' };
  if (!String(name || '').trim()) return { ok: false, error: 'กรุณากรอกชื่อ-นามสกุล' };
  const f = findMember_(email);
  if (f) {
    const st = f.v[COL.STATUS];
    if (st === 'approved') return { ok: false, error: 'อีเมลนี้ได้รับอนุมัติแล้ว ไปที่แท็บ "เข้าสู่ระบบ" ได้เลย' };
    if (st === 'pending') return { ok: false, error: 'อีเมลนี้สมัครไว้แล้ว กำลังรอการอนุมัติ' };
    // rejected / revoked -> ขอใหม่ได้
    f.sh.getRange(f.row, COL.STATUS + 1).setValue('pending');
    f.sh.getRange(f.row, COL.NAME + 1).setValue(String(name).trim());
  } else {
    members_().appendRow([email, String(name).trim(), 'user', 'pending', new Date(), '', '', 0, '', '']);
  }
  try {
    MailApp.sendEmail(SEED_ADMIN, '[FIXTAB] มีผู้ขออนุมัติเข้าใช้งาน: ' + email,
      'ผู้ใช้ใหม่: ' + name + ' <' + email + '>\nเข้าไปอนุมัติที่เมนู Admin Management ของโปรแกรม');
  } catch (err) { /* ไม่ให้ล้มเพราะโควต้าอีเมล */ }
  return { ok: true, message: 'ส่งคำขอแล้ว รอผู้ดูแลระบบอนุมัติ (ระบบจะส่งอีเมลแจ้งเมื่ออนุมัติ)' };
}

function requestOtp_(email) {
  email = norm_(email);
  const f = findMember_(email);
  if (!f) return { ok: false, error: 'ไม่พบอีเมลนี้ กรุณาสมัครสมาชิกก่อน' };
  const st = f.v[COL.STATUS];
  if (st !== 'approved') return { ok: false, error: 'บัญชียังไม่ได้รับอนุมัติ (สถานะ: ' + st + ')' };
  const lastSent = Number(f.v[COL.OTP_SENT]) || 0;
  if (now_() - lastSent < OTP_RESEND_SEC * 1000) {
    return { ok: false, error: 'ขอรหัสถี่เกินไป กรุณารอ ' + OTP_RESEND_SEC + ' วินาที' };
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  f.sh.getRange(f.row, COL.OTP_HASH + 1, 1, 4).setValues([[
    sha_(code + '|' + email + '|' + props_().getProperty('TOKEN_SECRET')),
    now_() + OTP_TTL_MIN * 60000, 0, now_()
  ]]);
  MailApp.sendEmail(email, '[FIXTAB] รหัสเข้าใช้งาน: ' + code,
    'รหัส OTP ของคุณคือ  ' + code + '\nหมดอายุใน ' + OTP_TTL_MIN + ' นาที\n\nหากคุณไม่ได้ขอรหัสนี้ ให้เพิกเฉยต่ออีเมลฉบับนี้');
  return { ok: true, message: 'ส่งรหัส 6 หลักไปที่ ' + email + ' แล้ว' };
}

function verifyOtp_(email, code) {
  email = norm_(email);
  const f = findMember_(email);
  if (!f || f.v[COL.STATUS] !== 'approved') return { ok: false, error: 'บัญชีไม่ถูกต้องหรือยังไม่ได้รับอนุมัติ' };
  const exp = Number(f.v[COL.OTP_EXP]) || 0;
  const fails = Number(f.v[COL.OTP_FAILS]) || 0;
  if (!f.v[COL.OTP_HASH] || now_() > exp) return { ok: false, error: 'รหัสหมดอายุ กรุณาขอรหัสใหม่' };
  if (fails >= OTP_MAX_FAILS) return { ok: false, error: 'กรอกผิดเกินกำหนด กรุณาขอรหัสใหม่' };
  const h = sha_(String(code || '').trim() + '|' + email + '|' + props_().getProperty('TOKEN_SECRET'));
  if (h !== f.v[COL.OTP_HASH]) {
    f.sh.getRange(f.row, COL.OTP_FAILS + 1).setValue(fails + 1);
    return { ok: false, error: 'รหัสไม่ถูกต้อง' };
  }
  f.sh.getRange(f.row, COL.OTP_HASH + 1, 1, 3).setValues([['', 0, 0]]);
  f.sh.getRange(f.row, COL.LAST_LOGIN + 1).setValue(new Date());
  return {
    ok: true, email: email, name: f.v[COL.NAME], role: f.v[COL.ROLE],
    token: makeToken_(email), exp: now_() + SESSION_HOURS * 3600000
  };
}

function makeToken_(email) {
  const payload = Utilities.base64EncodeWebSafe(email + '|' + (now_() + SESSION_HOURS * 3600000));
  const sig = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, props_().getProperty('TOKEN_SECRET')));
  return payload + '.' + sig;
}

function auth_(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const parts = token.split('.');
  const sig = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], props_().getProperty('TOKEN_SECRET')));
  if (sig !== parts[1]) return null;
  const decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString().split('|');
  if (Number(decoded[1]) < now_()) return null;
  const f = findMember_(decoded[0]);
  if (!f || f.v[COL.STATUS] !== 'approved') return null;   // role/สถานะ อ่านสดจาก Sheet ทุกครั้ง
  return { email: decoded[0], name: f.v[COL.NAME], role: f.v[COL.ROLE] };
}

function listUsers_() {
  const data = members_().getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    rows.push({ email: data[i][COL.EMAIL], name: data[i][COL.NAME], role: data[i][COL.ROLE], status: data[i][COL.STATUS],
      createdAt: data[i][COL.CREATED], lastLogin: data[i][COL.LAST_LOGIN] });
  }
  return { ok: true, users: rows };
}

function countActiveAdmins_() {
  const data = members_().getDataRange().getValues();
  let n = 0;
  for (let i = 1; i < data.length; i++) if (data[i][COL.ROLE] === 'admin' && data[i][COL.STATUS] === 'approved') n++;
  return n;
}

function setStatus_(me, email, status) {
  email = norm_(email);
  if (['approved', 'rejected', 'revoked', 'pending'].indexOf(status) < 0) return { ok: false, error: 'สถานะไม่ถูกต้อง' };
  const f = findMember_(email);
  if (!f) return { ok: false, error: 'ไม่พบผู้ใช้นี้' };
  if (status !== 'approved' && f.v[COL.ROLE] === 'admin' && countActiveAdmins_() <= 1) {
    return { ok: false, error: 'ต้องมี Admin อย่างน้อย 1 คน' };
  }
  f.sh.getRange(f.row, COL.STATUS + 1).setValue(status);
  if (status === 'approved') {
    try {
      MailApp.sendEmail(email, '[FIXTAB] บัญชีของคุณได้รับอนุมัติแล้ว',
        'คุณสามารถเข้าสู่ระบบด้วยอีเมลนี้ได้แล้ว (ระบบจะส่งรหัส OTP ให้ทุกครั้งที่เข้าใช้งาน)\nอย่าลืมใส่ KEY ที่ผู้ดูแลระบบแจ้งให้');
    } catch (err) {}
  }
  return { ok: true };
}

function setRole_(me, email, role) {
  email = norm_(email);
  if (['admin', 'manager', 'user'].indexOf(role) < 0) return { ok: false, error: 'Role ไม่ถูกต้อง' };
  const f = findMember_(email);
  if (!f) return { ok: false, error: 'ไม่พบผู้ใช้นี้' };
  if (f.v[COL.ROLE] === 'admin' && role !== 'admin' && countActiveAdmins_() <= 1) {
    return { ok: false, error: 'ต้องมี Admin อย่างน้อย 1 คน' };
  }
  f.sh.getRange(f.row, COL.ROLE + 1).setValue(role);
  return { ok: true };
}

function addUser_(email, name, role) {
  email = norm_(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'รูปแบบอีเมลไม่ถูกต้อง' };
  if (['admin', 'manager', 'user'].indexOf(role) < 0) role = 'user';
  if (findMember_(email)) return { ok: false, error: 'มีอีเมลนี้อยู่แล้ว' };
  members_().appendRow([email, name || '', role, 'approved', new Date(), '', '', 0, '', '']);
  return { ok: true };
}

// ---------------------------------------------------------------- central data store
// เก็บ JSON ที่ถูก gzip+base64 แล้วจาก Browser เป็นชิ้นๆ ใน StoreA/StoreB สลับกัน
// เขียนลงชีตที่ "ไม่ใช้งาน" ก่อน แล้วค่อยสลับตอน commit -> คนที่กำลังดูข้อมูลอยู่ไม่เจอข้อมูลครึ่งๆ กลางๆ
function inactiveStore_() {
  return props_().getProperty('ACTIVE_STORE') === STORE_SHEETS[0] ? STORE_SHEETS[1] : STORE_SHEETS[0];
}

function saveChunk_(seq, text) {
  const name = inactiveStore_();
  const sh = getDB_().getSheetByName(name);
  seq = Number(seq) || 0;
  if (seq === 0) { sh.clear(); props_().setProperty('PENDING_ROWS', '0'); }
  text = String(text || '');
  const cells = [];
  for (let i = 0; i < text.length; i += CELL_LIMIT) cells.push([text.substr(i, CELL_LIMIT)]);
  if (!cells.length) return { ok: true };
  const start = Number(props_().getProperty('PENDING_ROWS') || '0') + 1;
  if (sh.getMaxRows() < start + cells.length) sh.insertRowsAfter(sh.getMaxRows(), start + cells.length - sh.getMaxRows() + 50);
  sh.getRange(start, 1, cells.length, 1).setValues(cells);
  props_().setProperty('PENDING_ROWS', String(start - 1 + cells.length));
  return { ok: true, rows: start - 1 + cells.length };
}

function commitData_(me, expectedChunks) {
  const name = inactiveStore_();
  const rows = Number(props_().getProperty('PENDING_ROWS') || '0');
  if (!rows) return { ok: false, error: 'ไม่มีข้อมูลที่ส่งมา' };
  const p = props_();
  p.setProperty('ACTIVE_STORE', name);
  p.setProperty('DATA_ROWS', String(rows));
  p.setProperty('DATA_VERSION', String(now_()));
  p.setProperty('DATA_UPDATED_BY', me.email);
  p.setProperty('PENDING_ROWS', '0');
  return { ok: true, version: p.getProperty('DATA_VERSION') };
}

function clearData_(me) {
  const p = props_();
  STORE_SHEETS.forEach(function (n) { getDB_().getSheetByName(n).clear(); });
  p.setProperty('ACTIVE_STORE', '');
  p.setProperty('DATA_ROWS', '0');
  p.setProperty('DATA_VERSION', String(now_()));
  p.setProperty('DATA_UPDATED_BY', me.email);
  return { ok: true, version: p.getProperty('DATA_VERSION') };
}

function dataInfo_() {
  const p = props_();
  return {
    ok: true,
    hasData: !!p.getProperty('ACTIVE_STORE') && Number(p.getProperty('DATA_ROWS') || 0) > 0,
    version: p.getProperty('DATA_VERSION') || '0',
    updatedBy: p.getProperty('DATA_UPDATED_BY') || '',
    rows: Number(p.getProperty('DATA_ROWS') || 0)
  };
}

function loadData_(offset, limit) {
  const p = props_();
  const name = p.getProperty('ACTIVE_STORE');
  const total = Number(p.getProperty('DATA_ROWS') || 0);
  if (!name || !total) return { ok: true, text: '', next: -1, total: 0, version: p.getProperty('DATA_VERSION') || '0' };
  offset = Number(offset) || 0;
  limit = Math.min(Number(limit) || 40, 60);
  const n = Math.min(limit, total - offset);
  const vals = n > 0 ? getDB_().getSheetByName(name).getRange(offset + 1, 1, n, 1).getValues() : [];
  const text = vals.map(function (r) { return r[0]; }).join('');
  const next = offset + n >= total ? -1 : offset + n;
  return { ok: true, text: text, next: next, total: total, version: p.getProperty('DATA_VERSION') };
}

// ---------------------------------------------------------------- upload log
function logUpload_(email, fileName, fileType, rowCount, note) {
  getDB_().getSheetByName(UPLOADS_SHEET).appendRow([new Date(), email || 'unknown', fileName || '', fileType || '', rowCount || 0, note || '']);
  return { ok: true };
}

function listUploads_() {
  const data = getDB_().getSheetByName(UPLOADS_SHEET).getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    rows.push({ timestamp: data[i][0], username: data[i][1], fileName: data[i][2], fileType: data[i][3], rowCount: data[i][4], note: data[i][5] });
  }
  return { ok: true, uploads: rows.slice(-300) };
}
