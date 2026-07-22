// ==========================================================================
// analyze.js — วิเคราะห์ข้อมูล Fixtab ในเบราว์เซอร์โดยตรง (ไม่ต้องใช้ Python)
// พอร์ตตรรกะหลักจาก run_fixtab_analysis.py มาเป็น JavaScript
//
// ⚠️ สถานะ BETA — ยังไม่ครอบคลุมทุกส่วนเท่าสคริปต์ Python:
//   ครอบคลุมแล้ว: จัดหมวดอุปกรณ์, แยกสัญญา PM, จำแนกลักษณะ Ticket, เกณฑ์ CAPEX/OPEX ระดับหมวด
//   ยังไม่ครอบคลุม: Direct match / Fuzzy match กับไฟล์ PR-PO Tracking (ต้องใช้สคริปต์ Python ก่อน)
//   → ถ้าต้องการตัวเลข Direct/Fuzzy match ที่แม่นยำ ยังต้องรันสคริปต์ Python ควบคู่ไปก่อน
// ==========================================================================

// ---------- CONFIG (ต้องตรงกับ run_fixtab_analysis.py เสมอ ถ้าแก้ฝั่งใดฝั่งหนึ่งต้องแก้อีกฝั่งด้วย) ----------
const RM_FINANCIAL_DIMENSION_PREFIXES = ["5311101", "5311114"];

const AN_CATEGORY_KEYWORDS = {
  "ตู้แช่ / ตู้เย็น / ตู้ฟรีซ": ["ตู้แช่", "ตู้เย็น", "ตู้ฟรีส", "ตู้ฟรีซ"],
  "เครื่องกรองน้ำ": ["เครื่องกรองน้ำ", "กรองน้ำ", "Bigblue"],
  "เครื่องชงกาแฟ": ["เครื่องชงกาแฟ", "ชงกาแฟ"],
  "เครื่องบดกาแฟ": ["เครื่องบดกาแฟ", "บดกาแฟ"],
  "เตา/ตู้อบ (ครัว)": ["เตาอบ", "เตาแก๊ส", "เตาไฟฟ้า", "เตากริล", "เตา Waffle", "เตา Convection",
                        "เตาต้ม", "เตาย่าง", "SALAMANDER", "ตู้อบ", "French Top"],
  "เครื่องตีแป้ง": ["เครื่องตีแป้ง"],
  "ระบบไฟฟ้า / โคมไฟ": ["Electrical", "ไฟฟ้า", "โคมไฟ", "หลอดไฟ", "Lighting"],
  "ระบบประปา / สุขาภิบาล": ["Sanitary", "ประปา", "ท่อน้ำ", "ก๊อกน้ำ", "ท่อระบาย"],
  "ระบบปรับอากาศ (แอร์)": ["AIR Condition", "Air Split", "เครื่องปรับอากาศ", "แอร์"],
  "ลิฟท์ / บันไดเลื่อน": ["ลิฟท์", "บันไดเลื่อน", "Lift", "Escalator"],
  "ประตูอัตโนมัติ": ["Auto Door", "ประตูอัตโนมัติ"],
  "เครื่องชั่ง / ตราชั่ง": ["เครื่องชั่ง", "ตราชั่ง"],
  "เครื่องล้างจาน / Pitcher Rinser": ["ล้างจาน", "Pitcher Rinser"],
  "ไมโครเวฟ": ["ไมโครเวฟ", "Microwave"],
  "เครื่องผลิตน้ำแข็ง": ["เครื่องผลิตน้ำแข็ง", "น้ำแข็ง"],
  "เครื่องปั่น": ["เครื่องปั่น"],
};

const PM_CONTRACT_KEYWORDS = ["สัญญา", "PM.", "บำรุงรักษาเชิงป้องกัน", "ต่อสัญญา", "ระยะเวลา 1 ปี",
                               "ครั้งที่ 1", "ครั้งที่ 2", "รายปี", "preventive"];

const CANCEL_KW = ["cancel", "ยกเลิก", "เปิด ticket ซ้ำ", "ซ้ำกับ", "เปิดผิด", "ticket ผิด"];
const CAPEX_SIGNAL_KW = ["ไม่คุ้ม", "ราคาซ่อมสูง", "รอ renovate", "รอทำพร้อม", "เสื่อมสภาพ",
                          "หมดอายุการใช้งาน", "ไม่เหมาะที่จะซ่อม", "ไม่เหมาะที่จะนำ"];
const OUTSOURCE_KW = ["ผรม", "ผู้รับเหมา", "ซัพ", "บริษัท", "supplier", "ผู้ขาย", "เคลมประกัน"];
const REPLACE_KW = ["เปลี่ยน", "สั่งซื้อ", "ซื้อ", "ติดตั้ง", "อะไหล่ใหม่", "นำเครื่องใหม่"];
const INHOUSE_ACTION_KW = ["ทำความสะอาด", "ปรับ", "แก้ไข", "ตรวจสอบ", "เช็ค", "ตั้งค่า", "reset", "รีเซ็ต",
                            "ฉีดพ่น", "ดำเนินการแก้ไข", "ซีล", "อัดจารบี", "ขันน็อต", "ขันสกรู", "เดินสาย",
                            "ล้าง", "เติมน้ำยา", "ตรวจเช็ค", "ผูก", "มัด", "ยึด", "ทะลวง", "เดรน", "แยงท่อ"];
const GENERIC_DONE_KW = ["ดำเนินการเรียบร้อย", "เรียบร้อยแล้ว", "แก้ไขเรียบร้อย", "เสร็จเรียบร้อย"];

const AN_CLASSIFICATION_ORDER = [
  "มีค่าใช้จ่ายระบุชัดเจน (Has explicit cost figure)",
  "จ้างผู้รับเหมา/ซัพพลายเออร์ (มีค่าใช้จ่ายแต่ไม่ระบุตัวเลข)",
  "เปลี่ยน/ซื้ออะไหล่ (คาดว่ามีค่าใช้จ่ายเล็กน้อย จากสต๊อก/เงินสดย่อย ไม่ถูกบันทึก)",
  "ซ่อมโดยช่างอาคารเอง ไม่เปลี่ยนอะไหล่ (คาดว่าไม่มีค่าใช้จ่ายวัสดุ)",
  "สัญญาณ CAPEX (ซ่อมไม่คุ้ม/รอเปลี่ยนใหม่)",
  "เสร็จงาน แต่ไม่ระบุวิธีการ (ข้อความกว้างเกินไป)",
  "ยกเลิก/เปิดซ้ำ (ไม่ใช่งานจริง)",
  "อื่นๆ / ข้อความไม่ชัดเจน",
  "ไม่มีข้อมูลบันทึก (No detail recorded)",
];

function anTagCategory(text) {
  if (typeof text !== "string") return null;
  const t = text.toLowerCase();
  for (const [cat, kws] of Object.entries(AN_CATEGORY_KEYWORDS)) {
    for (const kw of kws) {
      if (t.includes(kw.toLowerCase())) return cat;
    }
  }
  return null;
}

function anIsPmContract(text) {
  if (typeof text !== "string") return false;
  const t = text.toLowerCase();
  return PM_CONTRACT_KEYWORDS.some((kw) => t.includes(kw.toLowerCase()));
}

function anHasBaht(text) {
  return /\d[\d,]*\s*บาท/.test(text);
}

function anClassifyTicket(text) {
  if (typeof text !== "string" || text.trim() === "") return "ไม่มีข้อมูลบันทึก (No detail recorded)";
  const t = text.toLowerCase();
  if (CANCEL_KW.some((kw) => t.includes(kw))) return "ยกเลิก/เปิดซ้ำ (ไม่ใช่งานจริง)";
  if (CAPEX_SIGNAL_KW.some((kw) => t.includes(kw))) return "สัญญาณ CAPEX (ซ่อมไม่คุ้ม/รอเปลี่ยนใหม่)";
  if (anHasBaht(text)) return "มีค่าใช้จ่ายระบุชัดเจน (Has explicit cost figure)";
  if (OUTSOURCE_KW.some((kw) => t.includes(kw))) return "จ้างผู้รับเหมา/ซัพพลายเออร์ (มีค่าใช้จ่ายแต่ไม่ระบุตัวเลข)";
  if (REPLACE_KW.some((kw) => t.includes(kw))) return "เปลี่ยน/ซื้ออะไหล่ (คาดว่ามีค่าใช้จ่ายเล็กน้อย จากสต๊อก/เงินสดย่อย ไม่ถูกบันทึก)";
  if (INHOUSE_ACTION_KW.some((kw) => t.includes(kw))) return "ซ่อมโดยช่างอาคารเอง ไม่เปลี่ยนอะไหล่ (คาดว่าไม่มีค่าใช้จ่ายวัสดุ)";
  if (GENERIC_DONE_KW.some((kw) => t.includes(kw))) return "เสร็จงาน แต่ไม่ระบุวิธีการ (ข้อความกว้างเกินไป)";
  return "อื่นๆ / ข้อความไม่ชัดเจน";
}

function anSheetRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
  // บางไฟล์ (เช่น export จาก D365) มีช่องว่างแฝงในชื่อคอลัมน์ เช่น " NETAMOUNT " — ตัดออกให้สะอาด
  return rows.map((r) => {
    const clean = {};
    Object.keys(r).forEach((k) => { clean[k.trim()] = r[k]; });
    return clean;
  });
}

function anGroupBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((r) => {
    const k = keyFn(r);
    if (k === null || k === undefined) return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return map;
}

function anExtractTicNumbers(text) {
  const matches = [...text.matchAll(/TIC0*(\d+)/g)];
  return matches.map((m) => parseInt(m[1], 10));
}

// ---------- Direct Match: อ่านไฟล์งบ/PR-PO Tracking หาเลข Fixtab Ticket ที่อ้างอิงตรง ----------
async function findDirectMatchesJS(budgetFiles, fxRowsAll, onProgress) {
  const prog = (msg) => { if (onProgress) onProgress(msg); };
  const linkedRows = [];

  for (const file of budgetFiles) {
    prog(`กำลังอ่านไฟล์งบ: ${file.name}...`);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
      let headerRowIdx = null;
      for (let i = 0; i < Math.min(6, raw.length); i++) {
        const joined = (raw[i] || []).filter((c) => c != null).map((c) => String(c).toLowerCase()).join(" ");
        if (joined.includes("pr no") || joined.includes("description")) headerRowIdx = i;
      }
      if (headerRowIdx === null) continue;
      const header = (raw[headerRowIdx] || []).map((h) => (h == null ? "" : String(h).toLowerCase().trim()));
      const poNoCol = header.findIndex((h) => h.includes("po no") || h.includes("po number"));
      const amountPoCol = header.findIndex((h) => h.includes("amount") && h.includes("po"));
      const descCol = header.findIndex((h) => h.includes("description"));
      if (descCol === -1) continue;
      for (let r = headerRowIdx + 1; r < raw.length; r++) {
        const row = raw[r];
        if (!row) continue;
        const desc = row[descCol];
        if (typeof desc !== "string") continue;
        const tics = anExtractTicNumbers(desc);
        if (!tics.length) continue;
        tics.forEach((tic) => {
          linkedRows.push({
            tic_num: tic,
            po_no: poNoCol >= 0 ? row[poNoCol] : null,
            amount_po: amountPoCol >= 0 ? row[amountPoCol] : null,
            file: file.name, sheet: sheetName, description: desc,
          });
        });
      }
    }
  }

  prog(`พบเลข Ticket อ้างอิง ${linkedRows.length} รายการ — กำลังจับคู่กับ Fixtab...`);

  const fxByTic = new Map();
  fxRowsAll.forEach((r) => {
    const m = String(r["Ticket Number"] || "").match(/TIC0*(\d+)/);
    if (m) fxByTic.set(parseInt(m[1], 10), r);
  });

  const matchedGroups = new Map();
  const unmatchedRaw = [];
  linkedRows.forEach((lr) => {
    const fxRow = fxByTic.get(lr.tic_num);
    if (!fxRow) { unmatchedRaw.push(lr); return; }
    const key = fxRow["Ticket Number"];
    if (!matchedGroups.has(key)) {
      matchedGroups.set(key, {
        "Ticket Number": fxRow["Ticket Number"], "Branch Name": fxRow["Branch Name"],
        "Company Name": fxRow["Company Name"], "Product Name": fxRow["Product Name"],
        "Report Date": fxRow["Report Date"], "Status Ticket": fxRow["Status Ticket"], "Priority": fxRow["Priority"],
        total_cost: 0, po_numbers: [],
      });
    }
    const g = matchedGroups.get(key);
    g.total_cost += Number(lr.amount_po) || 0;
    if (lr.po_no) g.po_numbers.push(lr.po_no);
  });

  const linkedTickets = Array.from(matchedGroups.values()).map((g) => ({
    "Ticket Number": g["Ticket Number"], "Branch Name": g["Branch Name"], "Company Name": g["Company Name"],
    "Product Name": g["Product Name"], "Report Date": g["Report Date"], "Status Ticket": g["Status Ticket"],
    "Priority": g["Priority"], "Total Repair Cost (THB)": g.total_cost, "No. of PO Lines": g.po_numbers.length,
    "PO Number(s)": g.po_numbers.join(", "),
  })).sort((a, b) => b["Total Repair Cost (THB)"] - a["Total Repair Cost (THB)"]);

  const seenTic = new Set();
  const dataGaps = [];
  unmatchedRaw.forEach((u) => {
    if (seenTic.has(u.tic_num)) return;
    seenTic.add(u.tic_num);
    dataGaps.push({
      "Referenced Ticket No.": `TIC${String(u.tic_num).padStart(5, "0")}`,
      "Source File": u.file, "Sheet": u.sheet, "Description": u.description,
      "PO No.": u.po_no, "Amount (Baht)": u.amount_po,
    });
  });

  return { linkedTickets, dataGaps };
}

// ---------- Main pipeline ----------
async function analyzeRawFiles(fixtabFile, phaFile, budgetFiles, onProgress) {
  const prog = (msg) => { if (onProgress) onProgress(msg); };

  prog("กำลังอ่านไฟล์ Fixtab Export...");
  const fxBuf = await fixtabFile.arrayBuffer();
  const fxWb = XLSX.read(fxBuf, { type: "array", cellDates: true });
  const fxRows = anSheetRows(fxWb, "Ticket Report");
  if (!fxRows.length) throw new Error('ไม่พบชีต "Ticket Report" ในไฟล์ Fixtab Export');

  prog(`อ่าน Fixtab สำเร็จ ${fxRows.length.toLocaleString()} Ticket — กำลังจัดหมวดอุปกรณ์...`);
  fxRows.forEach((r) => {
    r.category = anTagCategory(r["Product Name"]) || anTagCategory(r["Issue Detail"]);
  });
  const taggedFx = fxRows.filter((r) => r.category);

  prog("กำลังอ่านไฟล์ PHA_report...");
  const phaBuf = await phaFile.arrayBuffer();
  const phaWb = XLSX.read(phaBuf, { type: "array", cellDates: true });
  const phaRows = anSheetRows(phaWb, "Sheet1");
  if (!phaRows.length) throw new Error('ไม่พบชีต "Sheet1" ในไฟล์ PHA_report');

  const rmRows = phaRows.filter((r) => {
    const fd = String(r["FINANCIALDIMENSION"] || "");
    return RM_FINANCIAL_DIMENSION_PREFIXES.some((p) => fd.startsWith(p));
  });
  rmRows.forEach((r) => { r.category = anTagCategory(r["TEXT"]); });
  const taggedRm = rmRows.filter((r) => r.category);

  prog(`จัดหมวดได้ Fixtab ${taggedFx.length}/${fxRows.length}, R&M ${taggedRm.length}/${rmRows.length} — กำลังแยกสัญญา PM...`);

  const pmExcluded = taggedRm.filter((r) => anIsPmContract(r["TEXT"]));
  const oneoff = taggedRm.filter((r) => !anIsPmContract(r["TEXT"]));

  prog("กำลังจำแนกลักษณะ Ticket ที่ปิดงานแล้ว...");
  const doneTickets = fxRows.filter((r) => ["Done", "Closed"].includes(r["Status Ticket"]));
  doneTickets.forEach((r) => { r.repair_class = anClassifyTicket(r["Complete Detail"]); });

  prog("กำลังสรุปตารางระดับหมวดอุปกรณ์...");

  // Category Summary (รวม PM) — เทียบเท่าไฟล์ 2
  const categorySummary = [];
  const fxByCat = anGroupBy(taggedFx, (r) => r.category);
  const rmByCat = anGroupBy(taggedRm, (r) => r.category);
  const allCatsAll = new Set([...fxByCat.keys(), ...rmByCat.keys()]);
  allCatsAll.forEach((cat) => {
    const ticketCount = (fxByCat.get(cat) || []).length;
    const costRows = rmByCat.get(cat) || [];
    const costTotal = costRows.reduce((a, r) => a + (Number(r["NETAMOUNT"]) || 0), 0);
    categorySummary.push({
      "หมวดอุปกรณ์": cat,
      "จำนวน Ticket (Fixtab)": ticketCount,
      "ค่าใช้จ่ายที่ระบุหมวดได้ (บาท)": costTotal,
      "ค่าเฉลี่ย/Ticket (บาท)": ticketCount ? Math.round(costTotal / ticketCount) : 0,
    });
  });
  categorySummary.sort((a, b) => b["ค่าใช้จ่ายที่ระบุหมวดได้ (บาท)"] - a["ค่าใช้จ่ายที่ระบุหมวดได้ (บาท)"]);

  // Category Threshold (คัด PM ออก) — เทียบเท่าไฟล์ 4
  const categoryExtended = [];
  const oneoffByCat = anGroupBy(oneoff, (r) => r.category);
  const allCatsOneoff = new Set([...fxByCat.keys(), ...oneoffByCat.keys()]);
  allCatsOneoff.forEach((cat) => {
    const ticketCount = (fxByCat.get(cat) || []).length;
    const costRows = oneoffByCat.get(cat) || [];
    const costTotal = costRows.reduce((a, r) => a + (Number(r["NETAMOUNT"]) || 0), 0);
    const avgCost = costRows.length ? costTotal / costRows.length : 0;
    categoryExtended.push({
      "หมวดอุปกรณ์": cat,
      "จำนวน Ticket": ticketCount,
      "จำนวนครั้งที่ซ่อม (มี PR/PO)": costRows.length,
      "ค่าซ่อมรวม (บาท)": costTotal,
      "ค่าซ่อมเฉลี่ย/ครั้ง (บาท)": Math.round(avgCost),
      "ราคาเครื่องใหม่โดยประมาณ (บาท) [ต้องกรอก]": null,
      "% เทียบราคาใหม่": null,
      "คำแนะนำเบื้องต้น": "รอราคาเครื่องใหม่",
    });
  });
  categoryExtended.sort((a, b) => b["ค่าซ่อมรวม (บาท)"] - a["ค่าซ่อมรวม (บาท)"]);

  // Classification summary
  const classCounts = {};
  doneTickets.forEach((r) => { classCounts[r.repair_class] = (classCounts[r.repair_class] || 0) + 1; });
  const classification = AN_CLASSIFICATION_ORDER.map((c) => ({
    "กลุ่ม": c,
    "จำนวน": classCounts[c] || 0,
    "%": doneTickets.length ? Number(((classCounts[c] || 0) / doneTickets.length * 100).toFixed(1)) : 0,
  }));

  const allTicketsClassified = doneTickets.map((r) => ({
    "Ticket Number": r["Ticket Number"], "Branch Name": r["Branch Name"], "Product Name": r["Product Name"],
    "Report Date": r["Report Date"], "Priority": r["Priority"], "Complete Detail": r["Complete Detail"],
    "กลุ่ม": r.repair_class,
  }));

  const selfRepairNoCost = allTicketsClassified.filter(
    (r) => r["กลุ่ม"] === "ซ่อมโดยช่างอาคารเอง ไม่เปลี่ยนอะไหล่ (คาดว่าไม่มีค่าใช้จ่ายวัสดุ)"
  );

  const rawTicketsByCategory = taggedFx.map((r) => ({
    "Ticket Number": r["Ticket Number"], "Branch Name": r["Branch Name"], "Company Name": r["Company Name"],
    "Product Name": r["Product Name"], "category": r.category, "Report Date": r["Report Date"],
    "Status Ticket": r["Status Ticket"],
  }));

  const rawRMTransactions = taggedRm.map((r) => ({
    "Date": r["PRAPPROVEDDATE"], "category": r.category, "NETAMOUNT (Baht)": r["NETAMOUNT"], "Description": r["TEXT"],
  }));

  const rawOneoffCosts = oneoff.map((r) => ({
    "Date": r["PRAPPROVEDDATE"], "category": r.category, "NETAMOUNT (Baht)": r["NETAMOUNT"], "Description": r["TEXT"],
  }));

  const pmContractsExcluded = pmExcluded.map((r) => ({
    "date": r["PRAPPROVEDDATE"], "category": r.category, "NETAMOUNT": r["NETAMOUNT"], "TEXT": r["TEXT"],
  }));

  prog("เสร็จสิ้น กำลังบันทึกผลลัพธ์...");

  const summaryPct = AN_CLASSIFICATION_ORDER.map((c) => ({
    "กลุ่ม": c, "จำนวน Ticket": classCounts[c] || 0,
    "pct": doneTickets.length ? Number(((classCounts[c] || 0) / doneTickets.length * 100).toFixed(1)) : 0,
  }));

  // Direct match กับไฟล์งบ/PR-PO Tracking (ถ้ามีไฟล์ให้)
  let directResult = { linkedTickets: [], dataGaps: [] };
  let directNote = ["โหมดวิเคราะห์ในเบราว์เซอร์ยังไม่รองรับ Direct match กับไฟล์ PR-PO Tracking — ใช้สคริปต์ Python (run_fixtab_analysis.py) ถ้าต้องการข้อมูลไฟล์นี้"];
  if (budgetFiles && budgetFiles.length) {
    directResult = await findDirectMatchesJS(budgetFiles, fxRows, prog);
    directNote = [`Direct match จากไฟล์: ${budgetFiles.map((f) => f.name).join(", ")}`];
  }

  const nDirect = directResult.linkedTickets.length;
  const totalDirectCost = directResult.linkedTickets.reduce((a, r) => a + r["Total Repair Cost (THB)"], 0);
  const nFuzzy = 0; // Fuzzy match ยังไม่ได้พอร์ตเข้ามาเป็นส่วนหนึ่งของ comparisonSummary ในโหมดนี้

  const comparisonSummary = budgetFiles && budgetFiles.length ? [
    { "แนวทาง": "0. Direct match", "ผลลัพธ์": `${nDirect} Ticket — มูลค่ายืนยัน ${totalDirectCost.toLocaleString()} บาท`, "ระดับความเชื่อมั่น": "สูงมาก" },
    { "แนวทาง": "2. Category-level", "ผลลัพธ์": `${taggedFx.length} Ticket ถูกจัดหมวดได้ เทียบค่าใช้จ่าย ${taggedRm.reduce((a, r) => a + (Number(r["NETAMOUNT"]) || 0), 0).toLocaleString()} บาท`, "ระดับความเชื่อมั่น": "แนวทิศทาง" },
  ] : [];

  return {
    self_repair: {
      summary: summaryPct,
      allTicketsClassified,
      selfRepairNoCost,
      byCategory: [],
    },
    capex_opex: {
      readMe: ["สร้างจากการวิเคราะห์ในเบราว์เซอร์ (Beta)"],
      knownAssets: [],
      categoryExtended,
      pmContractsExcluded,
      classification,
      aboutFoodInvestigation: [],
      rawTicketsByCategory,
      rawOneoffCosts,
    },
    cost_2approaches: {
      comparisonSummary,
      categorySummary,
      fuzzyMatches: [],
      confirmedMatches: directResult.linkedTickets.map((r) => ({
        "Ticket Number": r["Ticket Number"], "Branch Name": r["Branch Name"], "Product Name": r["Product Name"],
        "Report Date": r["Report Date"], "Status Ticket": r["Status Ticket"], "Priority": r["Priority"],
        "Total Cost (Baht)": r["Total Repair Cost (THB)"], "PO Number(s)": r["PO Number(s)"],
      })),
      methodologyNotes: directNote,
      rawTicketsByCategory,
      rawRMTransactions,
    },
    budget_linked: {
      linkedTickets: directResult.linkedTickets,
      byBranch: [],
      byProduct: [],
      dataGaps: directResult.dataGaps,
      methodologyNotes: directNote,
    },
  };
}
