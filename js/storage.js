// ==========================================================================
// Storage V2: ข้อมูลกลาง (ทุกคนเห็นชุดเดียวกัน) เก็บที่ Apps Script / Google Sheet
// - Manager/Admin: saveStoredData / clearStoredData -> อัปโหลดขึ้นส่วนกลาง (gzip + base64 แล้วแบ่งชิ้น)
// - ทุก Role: loadStoredData -> ดาวน์โหลดจากส่วนกลาง และแคชใน IndexedDB (ดึงใหม่เฉพาะเมื่อ version เปลี่ยน)
// ==========================================================================

const IDB_NAME = "fixtab_storage";
const IDB_VERSION = 1;
const IDB_STORE = "kv";
const CACHE_KEY = "fixtab_central_cache";
const UPLOAD_PIECE = 1500000;   // ตัวอักษรต่อ 1 request ตอนอัปโหลด
const DOWNLOAD_CELLS = 40;      // เซลล์ต่อ 1 request ตอนดาวน์โหลด (~1.6MB)

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, "readonly").objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- แถบแจ้งสถานะ ----------
function storageToast(text, done) {
  let el = document.getElementById("storageToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "storageToast";
    el.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:9999;background:var(--surface,#17212B);color:var(--text,#fff);border:1px solid var(--accent,#E8A33D);padding:10px 14px;border-radius:8px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.4)";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.display = "block";
  if (done) setTimeout(() => { el.style.display = "none"; }, 2500);
}

// ---------- gzip + base64 ----------
async function packData(obj) {
  const json = JSON.stringify(obj);
  if (typeof CompressionStream === "undefined") return "J:" + json;
  const stream = new Blob([new TextEncoder().encode(json)]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return "G:" + btoa(bin);
}

async function unpackData(text) {
  if (!text) return {};
  if (text.startsWith("J:")) return JSON.parse(text.slice(2));
  const bin = atob(text.slice(2));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

// ---------- โหลดข้อมูลกลาง ----------
let _memo = null;   // { at, data } กัน dashboard เรียกหลายรอบในหน้าเดียว
async function loadStoredData(force) {
  if (!force && _memo && Date.now() - _memo.at < 30000) return _memo.data;
  let cached = null;
  try { cached = await idbGet(CACHE_KEY); } catch {}

  const info = await apiCall("dataInfo");
  if (!info.ok) {
    console.warn("dataInfo ล้มเหลว ใช้ข้อมูลแคช:", info.error);
    return cached ? cached.data : {};
  }
  if (!info.hasData) { _memo = { at: Date.now(), data: {} }; return {}; }
  if (cached && cached.version === info.version) { _memo = { at: Date.now(), data: cached.data }; return cached.data; }

  try {
    storageToast("กำลังดาวน์โหลดข้อมูลกลาง...");
    let text = "", offset = 0;
    while (offset >= 0) {
      const r = await apiCall("loadData", { offset, limit: DOWNLOAD_CELLS });
      if (!r.ok) throw new Error(r.error || "โหลดข้อมูลไม่สำเร็จ");
      text += r.text;
      offset = r.next;
      storageToast(`กำลังดาวน์โหลดข้อมูลกลาง... ${r.total ? Math.min(100, Math.round(((r.next < 0 ? r.total : r.next) / r.total) * 100)) : 100}%`);
    }
    const data = await unpackData(text);
    try { await idbSet(CACHE_KEY, { version: info.version, data }); } catch (e) { console.warn("แคชไม่สำเร็จ", e); }
    _memo = { at: Date.now(), data };
    storageToast("โหลดข้อมูลกลางเรียบร้อย", true);
    return data;
  } catch (err) {
    console.error(err);
    storageToast("โหลดข้อมูลกลางไม่สำเร็จ: " + err.message, true);
    return cached ? cached.data : {};
  }
}

// ---------- อัปโหลดข้อมูลกลาง (Manager/Admin) ----------
async function saveStoredData(data) {
  if (!canUpload()) { alert("เฉพาะ Manager/Admin เท่านั้นที่บันทึกข้อมูลกลางได้"); return false; }
  try {
    storageToast("กำลังเตรียมข้อมูล...");
    const packed = await packData(data);
    const pieces = Math.max(1, Math.ceil(packed.length / UPLOAD_PIECE));
    for (let i = 0; i < pieces; i++) {
      storageToast(`กำลังอัปโหลดข้อมูลกลาง ${i + 1}/${pieces}...`);
      const r = await apiCall("saveChunk", { seq: i, text: packed.substr(i * UPLOAD_PIECE, UPLOAD_PIECE) });
      if (!r.ok) throw new Error(r.error || "อัปโหลดไม่สำเร็จ");
    }
    const c = await apiCall("commitData", {});
    if (!c.ok) throw new Error(c.error || "commit ไม่สำเร็จ");
    try { await idbSet(CACHE_KEY, { version: c.version, data }); } catch {}
    _memo = { at: Date.now(), data };
    storageToast("บันทึกข้อมูลกลางเรียบร้อย — ทุกคนจะเห็นข้อมูลนี้ทันที", true);
    return true;
  } catch (err) {
    console.error(err);
    storageToast("บันทึกไม่สำเร็จ", true);
    alert("บันทึกข้อมูลกลางไม่สำเร็จ: " + (err.message || err));
    return false;
  }
}

async function clearStoredData() {
  if (!canUpload()) { alert("เฉพาะ Manager/Admin เท่านั้นที่ล้างข้อมูลกลางได้"); return false; }
  const r = await apiCall("clearData", {});
  if (!r.ok) { alert(r.error || "ล้างข้อมูลไม่สำเร็จ"); return false; }
  try { await idbDelete(CACHE_KEY); } catch {}
  _memo = { at: Date.now(), data: {} };
  return true;
}
