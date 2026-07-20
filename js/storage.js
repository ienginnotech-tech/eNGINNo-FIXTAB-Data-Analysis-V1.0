// ==========================================================================
// Storage: ใช้ IndexedDB แทน localStorage สำหรับเก็บข้อมูลวิเคราะห์ที่มีขนาดใหญ่
// (localStorage มีโควต้าจำกัดแค่ ~5-10MB ทำให้ข้อมูล Ticket จำนวนมาก + ข้อความยาวๆ เต็มพื้นที่ได้)
// IndexedDB มีโควต้าสูงกว่ามาก (หลักร้อย MB ขึ้นไป) เหมาะกับข้อมูลชุดใหญ่แบบนี้
// ==========================================================================

const IDB_NAME = "fixtab_storage";
const IDB_VERSION = 1;
const IDB_STORE = "kv";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
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

const DATA_KEY = "fixtab_data";

async function loadStoredData() {
  try {
    const data = await idbGet(DATA_KEY);
    return data || {};
  } catch (err) {
    console.error("โหลดข้อมูลจาก IndexedDB ไม่สำเร็จ:", err);
    return {};
  }
}

async function saveStoredData(data) {
  try {
    await idbSet(DATA_KEY, data);
    return true;
  } catch (err) {
    console.error("บันทึกข้อมูลลง IndexedDB ไม่สำเร็จ:", err);
    alert("บันทึกข้อมูลไม่สำเร็จ: " + (err.message || err));
    return false;
  }
}

async function clearStoredData() {
  try {
    await idbDelete(DATA_KEY);
    return true;
  } catch (err) {
    console.error("ล้างข้อมูลใน IndexedDB ไม่สำเร็จ:", err);
    return false;
  }
}
