// ==========================================================================
// Import: อัปโหลดไฟล์ต้นฉบับ 6 ไฟล์ (บันทึก log อย่างเดียว) และไฟล์ผลวิเคราะห์ 4 ไฟล์
// (แกะข้อมูลเต็มด้วย SheetJS แล้วเก็บลง localStorage ให้หน้า Dashboard ใช้ต่อ)
// ==========================================================================

const RAW_FILES = [
  { key: "fixtab_export", label: "Fixtab Export (ทุก Ticket)" },
  { key: "pha_report", label: "PHA_report.xlsx (D365 PR/PO)" },
  { key: "budget_2024", label: "04. Tracking Budget Control 2024" },
  { key: "budget_2025", label: "05. Tracking Budget Control 2025" },
  { key: "prpo_2026", label: "6. Overview PR-PO Tracking 2026" },
  { key: "bitec_checklist", label: "BITEC BURI Readiness Checklist" },
];

const ANALYSIS_FILES = [
  { key: "budget_linked", label: "1. Fixtab_Budget_Linked_Analysis.xlsx", parser: parseBudgetLinked },
  { key: "cost_2approaches", label: "2. Fixtab_Cost_Analysis_2Approaches.xlsx", parser: parseCost2Approaches },
  { key: "self_repair", label: "3. Fixtab_SelfRepair_vs_Procured.xlsx", parser: parseSelfRepair },
  { key: "capex_opex", label: "4. Fixtab_CAPEX_OPEX_Framework.xlsx", parser: parseCapexOpex },
];

// DATA_KEY, loadStoredData(), saveStoredData() ถูกย้ายไปอยู่ใน js/storage.js แล้ว (ใช้ IndexedDB แทน localStorage)

function sheetToRows(workbook, sheetName) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
}

// หา sheet ที่ชื่อใกล้เคียงที่สุด (กันเคส user เปิด/แก้ชื่อชีตเพี้ยนไปเล็กน้อย)
function findSheet(workbook, candidates) {
  for (const name of candidates) {
    if (workbook.SheetNames.includes(name)) return name;
  }
  // fallback: partial match
  for (const sn of workbook.SheetNames) {
    for (const c of candidates) {
      if (sn.trim() === c.trim()) return sn;
    }
  }
  return null;
}

// ---------- Parsers เฉพาะไฟล์ผลวิเคราะห์ทั้ง 4 ----------
function parseBudgetLinked(wb) {
  const s1 = findSheet(wb, ["Linked Ticket-Cost"]);
  const s2 = findSheet(wb, ["Summary by Branch"]);
  const s3 = findSheet(wb, ["Summary by Product"]);
  const s4 = findSheet(wb, ["Data Gaps (Unmatched Refs)"]);
  const s5 = findSheet(wb, ["Methodology & Notes"]);
  return {
    linkedTickets: s1 ? sheetToRowsSkipHeader(wb, s1, 4) : [],
    byBranch: s2 ? sheetToRowsSkipHeader(wb, s2, 4) : [],
    byProduct: s3 ? sheetToRowsSkipHeader(wb, s3, 4) : [],
    dataGaps: s4 ? sheetToRowsSkipHeader(wb, s4, 4) : [],
    methodologyNotes: s5 ? sheetToTextLines(wb, s5) : [],
  };
}

// อ่านชีตที่เป็นข้อความล้วน (ไม่มีตาราง) เอาแค่คอลัมน์ A ทุกแถวที่มีข้อความ
function sheetToTextLines(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  return raw
    .map((r) => (r && r[0] !== null && r[0] !== undefined ? String(r[0]) : ""))
    .filter((line) => line.trim() !== "");
}

function parseCost2Approaches(wb) {
  const sComp = findSheet(wb, ["Comparison Summary"]);
  const sCat = findSheet(wb, ["Category Summary"]);
  const sFuzzy = findSheet(wb, ["Fuzzy Matches (Review Needed)"]);
  const sConfirmed = findSheet(wb, ["Confirmed Direct Matches"]);
  const sMethod = findSheet(wb, ["Methodology & Caveats"]);
  const sRawTix = findSheet(wb, ["Raw Tickets by Category"]);
  const sRawRM = findSheet(wb, ["Raw R&M Transactions (Dated)"]);
  return {
    comparisonSummary: sComp ? sheetToRowsSkipHeader(wb, sComp, 4) : [],
    categorySummary: sCat ? sheetToRowsSkipHeader(wb, sCat, 4) : [],
    fuzzyMatches: sFuzzy ? sheetToRowsSkipHeader(wb, sFuzzy, 4) : [],
    confirmedMatches: sConfirmed ? sheetToRowsSkipHeader(wb, sConfirmed, 4) : [],
    methodologyNotes: sMethod ? sheetToTextLines(wb, sMethod) : [],
    rawTicketsByCategory: sRawTix ? sheetToRowsSkipHeader(wb, sRawTix, 4) : [],
    rawRMTransactions: sRawRM ? sheetToRowsSkipHeader(wb, sRawRM, 4) : [],
  };
}

function parseSelfRepair(wb) {
  const sSummary = findSheet(wb, ["Summary"]);
  const sAll = findSheet(wb, ["All Tickets Classified"]);
  const sNoCost = findSheet(wb, ["ซ่อมเองโดยช่างอาคาร (No Cost)"]);
  const sByCat = findSheet(wb, ["By Equipment Category"]);
  return {
    summary: sSummary ? sheetToRowsSkipHeader(wb, sSummary, 4) : [],
    allTicketsClassified: sAll ? sheetToRowsSkipHeader(wb, sAll, 1) : [],
    selfRepairNoCost: sNoCost ? sheetToRowsSkipHeader(wb, sNoCost, 3) : [],
    byCategory: sByCat ? sheetToRowsSkipHeader(wb, sByCat, 3) : [],
  };
}

function parseCapexOpex(wb) {
  const sReadMe = findSheet(wb, ["อ่านก่อน (Read Me)"]);
  const sKnown = findSheet(wb, ["Threshold Framework (Known)"]);
  const sExt = findSheet(wb, ["Category Threshold (ขยาย)"]);
  const sPM = findSheet(wb, ["PM Contracts (คัดออก)"]);
  const sClass = findSheet(wb, ["Ticket Classification (v2)"]);
  const sAboutFood = findSheet(wb, ["About Food - Investigation"]);
  const sRawTix = findSheet(wb, ["Raw Tickets by Category"]);
  const sRawOneoff = findSheet(wb, ["Raw Oneoff Costs (Dated)"]);
  return {
    readMe: sReadMe ? sheetToTextLines(wb, sReadMe) : [],
    knownAssets: sKnown ? sheetToRowsSkipHeader(wb, sKnown, 3) : [],
    categoryExtended: sExt ? sheetToRowsSkipHeader(wb, sExt, 4) : [],
    pmContractsExcluded: sPM ? sheetToRowsSkipHeader(wb, sPM, 3) : [],
    classification: sClass ? sheetToRowsSkipHeader(wb, sClass, 3) : [],
    aboutFoodInvestigation: sAboutFood ? sheetToTextLines(wb, sAboutFood) : [],
    rawTicketsByCategory: sRawTix ? sheetToRowsSkipHeader(wb, sRawTix, 4) : [],
    rawOneoffCosts: sRawOneoff ? sheetToRowsSkipHeader(wb, sRawOneoff, 4) : [],
  };
}

// อ่านชีตโดยข้าม N แถวแรก (ชื่อเรื่อง/หมายเหตุ) แล้วใช้แถวถัดไปเป็น header
function sheetToRowsSkipHeader(wb, sheetName, headerRowIndex) {
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  if (raw.length <= headerRowIndex) return [];
  const header = raw[headerRowIndex - 1].map((h) => (h === null ? "" : String(h).trim()));
  const rows = [];
  for (let i = headerRowIndex; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.every((c) => c === null || c === "")) continue;
    const obj = {};
    header.forEach((h, idx) => { if (h) obj[h] = r[idx] !== undefined ? r[idx] : null; });
    rows.push(obj);
  }
  return rows;
}

// ---------- UI wiring ----------
function initImportPage() {
  const rawContainer = document.getElementById("rawFilesList");
  const anaContainer = document.getElementById("analysisFilesList");

  RAW_FILES.forEach((f) => rawContainer.appendChild(makeFileRow(f, handleRawFile)));
  ANALYSIS_FILES.forEach((f) => anaContainer.appendChild(makeFileRow(f, handleAnalysisFile)));

  refreshStatusFromStorage();
}

function makeFileRow(fileMeta, handler) {
  const wrap = document.createElement("div");
  wrap.className = "file-row";
  wrap.id = `row_${fileMeta.key}`;
  wrap.innerHTML = `
    <span><span class="status-dot pending" id="dot_${fileMeta.key}"></span>${fileMeta.label}</span>
    <label class="btn secondary small" style="cursor:pointer;margin:0">
      เลือกไฟล์
      <input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleFileInput(event, '${fileMeta.key}')" />
    </label>
  `;
  return wrap;
}

function handleFileInput(event, key) {
  const file = event.target.files[0];
  if (!file) return;
  const rawMeta = RAW_FILES.find((f) => f.key === key);
  const anaMeta = ANALYSIS_FILES.find((f) => f.key === key);
  if (rawMeta) handleRawFile(file, rawMeta);
  if (anaMeta) handleAnalysisFile(file, anaMeta);
}

function setDot(key, state) {
  const dot = document.getElementById(`dot_${key}`);
  if (dot) dot.className = `status-dot ${state}`;
}

async function handleRawFile(file, meta) {
  setDot(meta.key, "pending");
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    let rowCount = 0;
    wb.SheetNames.forEach((sn) => { rowCount += (sheetToRows(wb, sn) || []).length; });
    setDot(meta.key, "ok");
    logUploadToBackend(file.name, meta.key, rowCount, "raw source file (log only)");
    markUploaded(meta.key, file.name);
  } catch (err) {
    setDot(meta.key, "err");
    console.error(err);
  }
}

async function handleAnalysisFile(file, meta) {
  setDot(meta.key, "pending");
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const parsed = meta.parser(wb);
    const data = await loadStoredData();
    data[meta.key] = parsed;
    data[meta.key + "_fileName"] = file.name;
    data[meta.key + "_uploadedAt"] = new Date().toISOString();
    const ok = await saveStoredData(data);
    if (!ok) { setDot(meta.key, "err"); return; }
    setDot(meta.key, "ok");
    let rowCount = 0;
    Object.values(parsed).forEach((v) => { if (Array.isArray(v)) rowCount += v.length; });
    logUploadToBackend(file.name, meta.key, rowCount, "analysis file (parsed for dashboard)");
    markUploaded(meta.key, file.name);
  } catch (err) {
    setDot(meta.key, "err");
    console.error(err);
    alert("อ่านไฟล์ไม่สำเร็จ: " + err.message);
  }
}

function markUploaded(key, fileName) {
  const row = document.getElementById(`row_${key}`);
  if (!row) return;
  let tag = row.querySelector(".uploaded-tag");
  if (!tag) {
    tag = document.createElement("span");
    tag.className = "uploaded-tag mono";
    tag.style.cssText = "font-size:11px;color:var(--text-muted);margin-left:8px";
    row.querySelector("span").appendChild(tag);
  }
  tag.textContent = ` (${fileName})`;
}

async function refreshStatusFromStorage() {
  const data = await loadStoredData();
  ANALYSIS_FILES.forEach((f) => {
    if (data[f.key]) {
      setDot(f.key, "ok");
      markUploaded(f.key, data[f.key + "_fileName"] || "อัปโหลดแล้ว");
    }
  });
}

async function logUploadToBackend(fileName, fileType, rowCount, note) {
  const session = getSession();
  await apiCall("logUpload", {
    username: session ? session.username : "unknown",
    fileName, fileType, rowCount, note,
  });
}

// ---------- ล้างข้อมูล ----------

// ล้างสถานะไฟล์ต้นฉบับ (Input) — รีเซ็ตจุดสถานะกลับเป็น "ยังไม่เลือก" ในหน้าจอปัจจุบัน
// (ไฟล์ต้นฉบับไม่ได้เก็บถาวรใน localStorage อยู่แล้ว แค่รีเซ็ตหน้าตาบนจอ)
function clearInputStatus() {
  if (!confirm("ล้างสถานะไฟล์ต้นฉบับ (Input) ทั้ง 6 รายการ? การอัปโหลดจะเริ่มนับใหม่ในหน้านี้")) return;
  RAW_FILES.forEach((f) => {
    setDot(f.key, "pending");
    const row = document.getElementById(`row_${f.key}`);
    const tag = row && row.querySelector(".uploaded-tag");
    if (tag) tag.remove();
    const input = row && row.querySelector('input[type="file"]');
    if (input) input.value = "";
  });
  const session = getSession();
  logUploadToBackend("-", "clear_input", 0, `ล้างสถานะ Input โดย ${session ? session.username : "unknown"}`);
  alert("ล้างสถานะไฟล์ต้นฉบับเรียบร้อย");
}

// ล้างข้อมูลวิเคราะห์ (Output) — ลบข้อมูลที่ parse ไว้ทั้งหมดออกจาก IndexedDB
// มีผลกับหน้า Dashboard โดยตรง (ต้องอัปโหลดไฟล์วิเคราะห์ 4 ไฟล์ใหม่หลังล้าง)
async function clearOutputData() {
  if (!confirm("ล้างข้อมูลวิเคราะห์ทั้งหมด (Output) ที่ใช้แสดงผลใน Dashboard?\nต้องอัปโหลดไฟล์วิเคราะห์ 4 ไฟล์ใหม่หลังล้าง — ไฟล์จริงในเครื่องคุณไม่หายไปไหน")) return;
  await clearStoredData();
  ANALYSIS_FILES.forEach((f) => {
    setDot(f.key, "pending");
    const row = document.getElementById(`row_${f.key}`);
    const tag = row && row.querySelector(".uploaded-tag");
    if (tag) tag.remove();
    const input = row && row.querySelector('input[type="file"]');
    if (input) input.value = "";
  });
  const session = getSession();
  logUploadToBackend("-", "clear_output", 0, `ล้างข้อมูล Output/Dashboard โดย ${session ? session.username : "unknown"}`);
  alert("ล้างข้อมูลวิเคราะห์เรียบร้อย — Dashboard จะว่างจนกว่าจะอัปโหลดไฟล์ใหม่");
}

// ---------- ซ่อน/แสดง ตัวเลือกอัปโหลด 4 ไฟล์แบบเดิม (จากสคริปต์ Python) ----------
function toggleLegacyImport(event) {
  event.preventDefault();
  const card = document.getElementById("legacyImportCard");
  const link = document.getElementById("legacyToggleLink");
  const isHidden = card.style.display === "none";
  card.style.display = isHidden ? "block" : "none";
  link.textContent = link.textContent.replace(isHidden ? "▸" : "▾", isHidden ? "▾" : "▸");
}

// ---------- วิเคราะห์ในเบราว์เซอร์ (Beta) — ไม่ต้องใช้ Python ----------
async function runBrowserAnalysis(event) {
  const fixtabInput = document.getElementById("anFixtabInput");
  const phaInput = document.getElementById("anPhaInput");
  const budgetInput = document.getElementById("anBudgetInput");
  const progressBox = document.getElementById("anProgress");

  if (!fixtabInput.files[0] || !phaInput.files[0]) {
    alert("กรุณาเลือกไฟล์ให้ครบทั้ง 2 ไฟล์ (Fixtab Export และ PHA_report)");
    return;
  }

  const budgetFiles = Array.from(budgetInput.files || []);

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = "กำลังวิเคราะห์...";

  try {
    const result = await analyzeRawFiles(fixtabInput.files[0], phaInput.files[0], budgetFiles, (msg) => {
      progressBox.textContent = "⏳ " + msg;
    });

    const data = await loadStoredData();
    data.self_repair = result.self_repair;
    data.self_repair_fileName = "วิเคราะห์ในเบราว์เซอร์ (Beta)";
    data.self_repair_uploadedAt = new Date().toISOString();
    data.capex_opex = result.capex_opex;
    data.capex_opex_fileName = "วิเคราะห์ในเบราว์เซอร์ (Beta)";
    data.capex_opex_uploadedAt = new Date().toISOString();
    data.cost_2approaches = result.cost_2approaches;
    data.cost_2approaches_fileName = "วิเคราะห์ในเบราว์เซอร์ (Beta)";
    data.cost_2approaches_uploadedAt = new Date().toISOString();
    data.budget_linked = result.budget_linked;
    data.budget_linked_fileName = budgetFiles.length
      ? "วิเคราะห์ในเบราว์เซอร์ (Beta) — Direct Match"
      : "วิเคราะห์ในเบราว์เซอร์ (Beta) — ไม่มีไฟล์งบ ข้าม Direct Match";
    data.budget_linked_uploadedAt = new Date().toISOString();

    const ok = await saveStoredData(data);
    if (!ok) throw new Error("บันทึกข้อมูลไม่สำเร็จ (พื้นที่เก็บข้อมูลอาจเต็ม)");

    setDot("self_repair", "ok"); markUploaded("self_repair", "Beta: วิเคราะห์ในเบราว์เซอร์");
    setDot("capex_opex", "ok"); markUploaded("capex_opex", "Beta: วิเคราะห์ในเบราว์เซอร์");
    setDot("cost_2approaches", "ok"); markUploaded("cost_2approaches", "Beta: วิเคราะห์ในเบราว์เซอร์");
    setDot("budget_linked", "ok"); markUploaded("budget_linked", "Beta: วิเคราะห์ในเบราว์เซอร์");

    const directNote = budgetFiles.length
      ? ` (จับคู่ Direct Match ได้ ${result.budget_linked.linkedTickets.length.toLocaleString()} Ticket)`
      : " (ไม่ได้ใส่ไฟล์งบ — ข้าม Direct Match)";
    progressBox.innerHTML = `✅ วิเคราะห์สำเร็จ! Ticket ที่จัดหมวดได้ ${result.cost_2approaches.rawTicketsByCategory.length.toLocaleString()} รายการ${directNote} — <a href="dashboard.html">ไปที่ Dashboard →</a>`;

    const session = getSession();
    const allFileNames = [fixtabInput.files[0].name, phaInput.files[0].name, ...budgetFiles.map((f) => f.name)].join(" + ");
    logUploadToBackend(allFileNames, "browser_analysis",
      result.cost_2approaches.rawTicketsByCategory.length, `วิเคราะห์ในเบราว์เซอร์โดย ${session ? session.username : "unknown"}`);
  } catch (err) {
    console.error(err);
    progressBox.innerHTML = `<span style="color:var(--danger)">❌ วิเคราะห์ไม่สำเร็จ: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "▶ เริ่มวิเคราะห์";
  }
}

async function clearAllData() {
  if (!confirm("ล้างข้อมูลทั้งหมด (ทั้ง Input และ Output)? การกระทำนี้ยกเลิกไม่ได้")) return;
  await clearStoredData();
  [...RAW_FILES, ...ANALYSIS_FILES].forEach((f) => {
    setDot(f.key, "pending");
    const row = document.getElementById(`row_${f.key}`);
    const tag = row && row.querySelector(".uploaded-tag");
    if (tag) tag.remove();
    const input = row && row.querySelector('input[type="file"]');
    if (input) input.value = "";
  });
  const session = getSession();
  logUploadToBackend("-", "clear_all", 0, `ล้างข้อมูลทั้งหมดโดย ${session ? session.username : "unknown"}`);
  alert("ล้างข้อมูลทั้งหมดเรียบร้อย");
}
