// ==========================================================================
// operations.js — Dashboard ปฏิบัติงาน (MTTR / Maintainability / ค่าใช้จ่าย / ผลงานช่าง)
// ใช้ข้อมูลจาก Main_data_fixtab_analysis_ENRICHED.xlsx (คอลัมน์ X-AN)
// ==========================================================================

const COL = {
  ticket: "Ticket Number", company: "Company Name", branch: "Branch Name",
  reportDate: "Report Date", priority: "Priority", status: "Status Ticket",
  issueType: "Issue Type", ticketType: "Ticket Type", issueDetail: "Issue Detail",
  mttr: "เวลาในที่ดำเนินการ(V-T):ชั่วโมง)",
  response: "เวลาแจ้งงานถึงเข้าพื้นที่(T-F):ชั่วโมง)",
  tech1: "รายชื่อช่างที่ดำเนินการใน R คนที่ 1", tech2: "รายชื่อช่างที่ดำเนินการใน R คนที่ 2",
  tech3: "รายชื่อช่างที่ดำเนินการใน R คนที่ 3", tech4: "รายชื่อช่างที่ดำเนินการใน R คนที่ 4",
  tech5: "รายชื่อช่างที่ดำเนินการใน R คนที่ 5",
  ah: "ค่าแรงช่างอาคารดำเนินการ(50THB x ชั่วโมง x จำนวนช่าง)-THB",
  ai: "ค่าแรงผู้รับเหมาดำเนินการ(อ้างอิง PR/PO)",
  aj: "ค่าอะไหล่(อ้างอิง PR/PO)",
  ak: "ค่าซ่อมโดย ผู้รับเหมา(อ้างอิง PR/PO)",
  al: "ค่าบริหารจัดการ(THB) [กรอกเอง]",
  am: "ค่าใช้จ่ายรวม(AH-AL)-THB",
  an: "นับอาการเสียซ้ำที่จุดเดิม(ครั้ง)",
  building: "แยกข้อมูล Product Name(D)เป็นอาคาร เทียบกับข้อมูลในLocation(LocationName)",
  area: "แยกข้อมูล Issue detail(O)เป็นพื้นที่ เทียบกับข้อมูลในLocation(Area)",
};

// SLA เป้าหมาย (ชั่วโมง) ต่อ Priority — ตอนนี้แก้ได้ที่หน้า "ตั้งค่า" แล้ว (อ่านผ่าน getSlaSettings() ใน app.js)

const SYMPTOM_KEYWORDS = [
  "ก๊อกน้ำ", "สายชำระ", "โถส้วม", "โถปัสสาวะ", "ฝักบัว", "ท่อน้ำ", "ท่อระบาย", "ท่อตัน",
  "หลอดไฟ", "โคมไฟ", "สวิตช์ไฟ", "ปลั๊กไฟ", "สายไฟ", "เบรกเกอร์",
  "แอร์", "เครื่องปรับอากาศ", "พัดลม", "คอมเพรสเซอร์",
  "ประตู", "บานพับ", "กลอนประตู", "ลูกบิด", "กระจก",
  "ลิฟท์", "บันไดเลื่อน", "กระเบื้อง", "พื้น", "ฝ้าเพดาน", "ผนัง",
  "CCTV", "กล้องวงจรปิด", "อินเตอร์เน็ต", "Wifi", "โทรศัพท์",
  "เก้าอี้", "โต๊ะ", "เฟอร์นิเจอร์", "ป้าย", "Signage",
];

let opsFilterCompany = "all";
let opsFilterBranch = "all";
let opsFilterYear = "all";
let opsFilterMonth = "all";
let opsFilterDay = "all";
let opsJobStatusFilter = "all";

const OPS_THAI_MONTHS = ["01-ม.ค.", "02-ก.พ.", "03-มี.ค.", "04-เม.ย.", "05-พ.ค.", "06-มิ.ย.",
                          "07-ก.ค.", "08-ส.ค.", "09-ก.ย.", "10-ต.ค.", "11-พ.ย.", "12-ธ.ค."];

function opsParseDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;
  if (typeof v === "string") {
    const m = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]));
  }
  return null;
}

function opsRowPassesDateFilter(r) {
  if (opsFilterYear === "all" && opsFilterMonth === "all" && opsFilterDay === "all") return true;
  const d = opsParseDate(r[COL.reportDate]);
  if (!d) return true;
  if (opsFilterYear !== "all" && d.getFullYear() !== parseInt(opsFilterYear)) return false;
  if (opsFilterMonth !== "all" && d.getMonth() + 1 !== parseInt(opsFilterMonth)) return false;
  if (opsFilterDay !== "all" && d.getDate() !== parseInt(opsFilterDay)) return false;
  return true;
}

function onum(v) {
  const n = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : v;
  return typeof n === "number" && !isNaN(n) ? n : null;
}

async function buildOperationsPage() {
  const main = document.getElementById("mainContent");
  const data = await loadStoredData();
  const mainData = data.main_data && data.main_data.rows ? data.main_data.rows : null;

  if (!mainData || !mainData.length) {
    main.innerHTML = `
      <div class="topbar"><div><div class="eyebrow">Work Request</div><h2>ภาพรวมงานปฏิบัติการ</h2></div></div>
      <div class="card empty">
        ยังไม่มีข้อมูล — ไปที่ <a href="import.html">นำเข้าข้อมูล</a> แล้วในขั้นตอนที่ 2
        ("🧪 การวิเคราะห์ข้อมูล Fixtab + File สำคัญ") ใส่ไฟล์ Fixtab Export + PHA_report +
        <b>Location.xlsx</b> แล้วกด "เริ่มวิเคราะห์" — ระบบจะสร้างข้อมูลหน้านี้ให้อัตโนมัติ
        (ไม่ต้องอัปโหลดไฟล์แยกที่ขั้นตอนที่ 3 อีกแล้ว)
      </div>`;
    return;
  }

  const companies = Array.from(new Set(mainData.map((r) => r[COL.company]).filter(Boolean))).sort();
  const branchesForCompany = (company) => {
    const rows = company === "all" ? mainData : mainData.filter((r) => r[COL.company] === company);
    return Array.from(new Set(rows.map((r) => r[COL.branch]).filter(Boolean))).sort();
  };

  const filtered = mainData.filter((r) =>
    (opsFilterCompany === "all" || r[COL.company] === opsFilterCompany) &&
    (opsFilterBranch === "all" || r[COL.branch] === opsFilterBranch) &&
    opsRowPassesDateFilter(r)
  );

  const years = Array.from(new Set(mainData.map((r) => { const d = opsParseDate(r[COL.reportDate]); return d ? d.getFullYear() : null; }).filter(Boolean))).sort((a, b) => b - a);

  main.innerHTML = `
    <div class="topbar" style="margin-bottom:14px;flex-wrap:wrap">
      <div><div class="eyebrow">Work Request</div><h2 style="font-size:19px">ภาพรวมงานปฏิบัติการ</h2></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select id="opsCompanySel" style="width:auto;min-width:200px" onchange="onOpsCompanyChange(this.value)">
          <option value="all">ทุกบริษัท (All Company)</option>
          ${companies.map((c) => `<option value="${c}" ${opsFilterCompany === c ? "selected" : ""}>${c}</option>`).join("")}
        </select>
        <select id="opsBranchSel" style="width:auto;min-width:160px" onchange="onOpsBranchChange(this.value)">
          <option value="all">ทุกสาขา (All Branch)</option>
          ${branchesForCompany(opsFilterCompany).map((b) => `<option value="${b}" ${opsFilterBranch === b ? "selected" : ""}>${b}</option>`).join("")}
        </select>
        <select id="opsYearSel" style="width:auto;min-width:90px" onchange="onOpsDateChange('year', this.value)">
          <option value="all">ทุกปี</option>
          ${years.map((y) => `<option value="${y}" ${opsFilterYear == y ? "selected" : ""}>ปี ${y}</option>`).join("")}
        </select>
        <select id="opsMonthSel" style="width:auto;min-width:100px" onchange="onOpsDateChange('month', this.value)">
          <option value="all">ทุกเดือน</option>
          ${OPS_THAI_MONTHS.map((m, i) => `<option value="${i + 1}" ${opsFilterMonth == i + 1 ? "selected" : ""}>${m}</option>`).join("")}
        </select>
        <select id="opsDaySel" style="width:auto;min-width:80px" onchange="onOpsDateChange('day', this.value)">
          <option value="all">ทุกวัน</option>
          ${Array.from({ length: 31 }, (_, i) => i + 1).map((d) => `<option value="${d}" ${opsFilterDay == d ? "selected" : ""}>วันที่ ${d}</option>`).join("")}
        </select>
        <button class="btn secondary small" onclick="buildOperationsPage()">↻ Refresh</button>
      </div>
    </div>
    <div id="opsBody"></div>
  `;

  renderOperationsBody(filtered);
}

function onOpsDateChange(kind, val) {
  if (kind === "year") opsFilterYear = val;
  if (kind === "month") opsFilterMonth = val;
  if (kind === "day") opsFilterDay = val;
  buildOperationsPage();
}

function onOpsCompanyChange(val) { opsFilterCompany = val; opsFilterBranch = "all"; buildOperationsPage(); }
function onOpsBranchChange(val) { opsFilterBranch = val; buildOperationsPage(); }

function groupCount(rows, keyFn) {
  const map = new Map();
  rows.forEach((r) => {
    const k = keyFn(r) || "(ไม่ระบุ)";
    map.set(k, (map.get(k) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function groupSum(rows, keyFn, valFn) {
  const map = new Map();
  rows.forEach((r) => {
    const k = keyFn(r) || "(ไม่ระบุ)";
    const v = valFn(r) || 0;
    map.set(k, (map.get(k) || 0) + v);
  });
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

const OPS_PALETTE = ["#5B8DEF", "#E8A33D", "#3FA796", "#D9685F", "#B98CE0", "#4FC3E0", "#E0A24F", "#7A8CFF", "#5BD1A0", "#E0625B"];

function breakdownCardHTML(id, title, unitLabel) {
  return `
    <div class="section-title" style="margin:14px 0 6px 0">${title}</div>
    <div class="grid cols-3" style="margin-bottom:4px">
      <div class="card" style="padding:10px;height:200px;box-sizing:border-box">
        <div style="position:relative;width:100%;height:100%"><canvas id="chart_${id}"></canvas></div>
      </div>
      <div class="card" style="padding:10px;height:200px;box-sizing:border-box">
        <div style="position:relative;width:100%;height:100%"><canvas id="donut_${id}"></canvas></div>
      </div>
      <div class="card" style="padding:0;overflow:auto;height:200px;box-sizing:border-box">
        <table style="font-size:12px;table-layout:fixed;width:100%">
          <colgroup><col style="width:70%"><col style="width:30%"></colgroup>
          <thead><tr><th>รายการ</th><th style="text-align:right">${unitLabel}</th></tr></thead>
          <tbody id="tbl_${id}"></tbody>
        </table>
      </div>
    </div>
  `;
}

function renderDonut(canvasId, items, valueKey, maxItems) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const top = items.slice(0, maxItems || 6);
  const total = items.reduce((a, it) => a + it[valueKey], 0);
  const rest = total - top.reduce((a, it) => a + it[valueKey], 0);
  const labels = top.map((it) => it.label.length > 16 ? it.label.slice(0, 14) + "…" : it.label);
  const values = top.map((it) => it[valueKey]);
  if (rest > 0) { labels.push("อื่นๆ"); values.push(rest); }
  new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: OPS_PALETTE, borderWidth: 0 }] },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { position: "bottom", labels: { color: "#8A97A6", font: { size: 8 }, boxWidth: 8, padding: 4 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed;
              const pct = total ? ((v / total) * 100).toFixed(1) : 0;
              return `${ctx.label}: ${fmtNumber(v)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

function renderBreakdownChartAndTable(id, items, valueKey, color, maxItems) {
  const top = items.slice(0, maxItems || 10);
  const tbody = document.getElementById(`tbl_${id}`);
  if (tbody) {
    tbody.innerHTML = top.map((it) =>
      `<tr><td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${it.label}</td><td class="mono" style="text-align:right">${fmtNumber(it[valueKey])}</td></tr>`
    ).join("") || `<tr><td colspan="2" class="empty">ไม่มีข้อมูล</td></tr>`;
  }
  const ctx = document.getElementById(`chart_${id}`);
  if (ctx) {
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: top.map((it) => (it.label.length > 22 ? it.label.slice(0, 20) + "…" : it.label)),
        datasets: [{ data: top.map((it) => it[valueKey]), backgroundColor: color }],
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#8A97A6", font: { size: 9 } }, grid: { color: "#2A3746" } },
          y: { ticks: { color: "#8A97A6", font: { size: 9 } }, grid: { display: false } },
        },
      },
    });
  }
  renderDonut(`donut_${id}`, items, valueKey, maxItems);
}

function extractTopSymptom(issueDetailTexts) {
  const counts = {};
  issueDetailTexts.forEach((text) => {
    if (typeof text !== "string") return;
    SYMPTOM_KEYWORDS.forEach((kw) => {
      if (text.includes(kw)) counts[kw] = (counts[kw] || 0) + 1;
    });
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? `${sorted[0][0]} (${sorted[0][1]} ครั้ง)` : "-";
}

let opsCurrentRows = [];

function onOpsJobStatusChange(val) {
  opsJobStatusFilter = val;
  renderOpsJobList(opsCurrentRows);
}

function onOpsStatusRowClick(statusLabel) {
  opsJobStatusFilter = statusLabel;
  const sel = document.getElementById("opsJobStatusSel");
  if (sel) sel.value = statusLabel;
  renderOpsJobList(opsCurrentRows);
  const card = document.getElementById("opsJobListCard");
  if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderOpsJobList(rows) {
  const card = document.getElementById("opsJobListCard");
  if (!card) return;
  let list = opsJobStatusFilter === "all" ? rows : rows.filter((r) => r[COL.status] === opsJobStatusFilter);
  list = list.slice().sort((a, b) => {
    const da = opsParseDate(a[COL.reportDate]);
    const db = opsParseDate(b[COL.reportDate]);
    return (db ? db.getTime() : -Infinity) - (da ? da.getTime() : -Infinity);
  });
  const showCount = Math.min(list.length, 500);
  card.innerHTML = `
    <table style="font-size:12px;table-layout:fixed;width:100%">
      <colgroup>
        <col style="width:9%"><col style="width:9%"><col style="width:10%"><col style="width:18%">
        <col style="width:12%"><col style="width:12%"><col style="width:30%">
      </colgroup>
      <thead><tr><th>Status</th><th>Report Date</th><th>Ticket Number</th><th>Product Name</th><th>Issue Type</th><th>Ticket Type</th><th>Issue Detail</th></tr></thead>
      <tbody>
        ${list.slice(0, showCount).map((r) => `<tr>
          <td><span class="badge ${r[COL.status] === "Done" || r[COL.status] === "Closed" ? "approved" : r[COL.status] === "Rejected" ? "rejected" : "pending"}">${r[COL.status] || "-"}</span></td>
          <td class="mono">${r[COL.reportDate] || "-"}</td>
          <td class="mono" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[COL.ticket] || "-"}</td>
          <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[COL.building] && r[COL.building] !== "" ? r[COL.building] : (r["Product Name"] || "-")}</td>
          <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[COL.issueType] || "-"}</td>
          <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[COL.ticketType] || "-"}</td>
          <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(r[COL.issueDetail] || "").toString().replace(/"/g, "&quot;")}">${(r[COL.issueDetail] || "-").toString().slice(0, 80)}</td>
        </tr>`).join("")}
        ${!list.length ? '<tr><td colspan="7" class="empty">ไม่พบข้อมูลตามตัวกรอง</td></tr>' : ""}
      </tbody>
    </table>
    ${list.length > showCount ? `<div style="padding:8px 12px;font-size:11px;color:var(--text-muted)">แสดง ${showCount.toLocaleString()} รายการแรกจากทั้งหมด ${list.length.toLocaleString()} รายการ — เลือกสถานะเพื่อกรองให้แคบลง</div>` : ""}
  `;
}

function renderOperationsBody(rows) {
  opsCurrentRows = rows;
  const body = document.getElementById("opsBody");

  const total = rows.length;
  const statusBreakdown = groupCount(rows, (r) => r[COL.status]);
  const statusMap = Object.fromEntries(statusBreakdown.map((s) => [s.label, s.count]));
  const open = (statusMap["New"] || 0) + (statusMap["Pending"] || 0);
  const inProgress = statusMap["In progress"] || 0;
  const closed = (statusMap["Done"] || 0) + (statusMap["Closed"] || 0);
  const highPriority = rows.filter((r) => r[COL.priority] === "High").length;

  const mttrVals = rows.map((r) => onum(r[COL.mttr])).filter((v) => v !== null);
  const avgMttr = mttrVals.length ? mttrVals.reduce((a, b) => a + b, 0) / mttrVals.length : null;
  const respVals = rows.map((r) => onum(r[COL.response])).filter((v) => v !== null);
  const avgResp = respVals.length ? respVals.reduce((a, b) => a + b, 0) / respVals.length : null;

  const slaSettings = getSlaSettings();
  const rowsWithMttr = rows.filter((r) => onum(r[COL.mttr]) !== null);
  let maintainability = null;
  if (rowsWithMttr.length) {
    const mVals = rowsWithMttr.map((r) => {
      const target = slaSettings[r[COL.priority]] || slaSettings.Default;
      const mttr = onum(r[COL.mttr]);
      return 1 - Math.exp(-target / mttr);
    });
    maintainability = (mVals.reduce((a, b) => a + b, 0) / mVals.length) * 100;
  }

  const sumCol = (col) => rows.reduce((a, r) => a + (onum(r[col]) || 0), 0);
  const costAH = sumCol(COL.ah), costAI = sumCol(COL.ai), costAJ = sumCol(COL.aj),
        costAK = sumCol(COL.ak), costAL = sumCol(COL.al);
  const costTotal = costAH + costAI + costAJ + costAK + costAL;

  const techStats = {};
  rows.forEach((r) => {
    const mttr = onum(r[COL.mttr]);
    [COL.tech1, COL.tech2, COL.tech3, COL.tech4, COL.tech5].forEach((c) => {
      const name = r[c];
      if (!name) return;
      if (!techStats[name]) techStats[name] = { count: 0, mttrSum: 0, mttrCount: 0 };
      techStats[name].count += 1;
      if (mttr !== null) { techStats[name].mttrSum += mttr; techStats[name].mttrCount += 1; }
    });
  });
  const techRows = Object.entries(techStats).map(([name, s]) => ({
    name, count: s.count, avgMttr: s.mttrCount ? s.mttrSum / s.mttrCount : null,
  })).sort((a, b) => b.count - a.count);

  const priorityBreak = groupCount(rows, (r) => r[COL.priority]);
  const issueTypeBreak = groupCount(rows, (r) => r[COL.issueType]);
  const ticketTypeBreak = groupCount(rows, (r) => r[COL.ticketType]);
  const buildingBreak = groupCount(rows, (r) => r[COL.building]);
  const areaBreak = groupCount(rows, (r) => r[COL.area]);
  const costByIssueType = groupSum(rows, (r) => r[COL.issueType], (r) => onum(r[COL.am]) || 0);

  const anBuckets = [
    { label: "ไม่เคยเสียซ้ำ (1 ครั้ง)", test: (v) => v === 1 },
    { label: "เสียซ้ำ 2 ครั้ง", test: (v) => v === 2 },
    { label: "เสียซ้ำ 3 ครั้ง", test: (v) => v === 3 },
    { label: "เสียซ้ำ 4 ครั้งขึ้นไป", test: (v) => v >= 4 },
  ];
  const anValues = rows.map((r) => onum(r[COL.an])).filter((v) => v !== null);
  const anBreak = anBuckets.map((b) => ({ label: b.label, count: anValues.filter(b.test).length })).filter((b) => b.count > 0);

  const repeatCandidates = rows.filter((r) => onum(r[COL.an]) >= 3);
  const repeatGroups = {};
  repeatCandidates.forEach((r) => {
    const key = `${r[COL.building] || "(ไม่ระบุ)"} | ${r[COL.issueType] || ""}`;
    if (!repeatGroups[key]) {
      repeatGroups[key] = { building: r[COL.building] || "(ไม่ระบุ)", issueType: r[COL.issueType] || "", count: onum(r[COL.an]), texts: [] };
    }
    repeatGroups[key].texts.push(r[COL.issueDetail]);
  });
  const repeatList = Object.values(repeatGroups)
    .map((g) => ({ ...g, symptom: extractTopSymptom(g.texts) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const V = (id) => isSectionVisible("workrequest", id);

  const statusPct = statusBreakdown.map((s) => ({ label: s.label, count: s.count, pct: total ? (s.count / total * 100) : 0 }));

  const parts = [];

  if (V("kpi")) {
    parts.push(`
    <div class="grid cols-4">
      <div class="card kpi" style="padding:12px"><div class="label">Work Request ทั้งหมด</div><div class="value" style="font-size:22px">${fmtNumber(total)}</div><div class="sub">Open ${fmtNumber(open)} / In Progress ${fmtNumber(inProgress)} / Closed ${fmtNumber(closed)}</div></div>
      <div class="card kpi ${avgMttr && avgMttr < 24 ? "ok" : "warn"}" style="padding:12px"><div class="label">MTTR เฉลี่ย</div><div class="value" style="font-size:22px">${avgMttr ? avgMttr.toFixed(1) + " ชม." : "-"}</div><div class="sub">Response เฉลี่ย ${avgResp ? avgResp.toFixed(1) + " ชม." : "-"}</div></div>
      <div class="card kpi ${maintainability && maintainability >= 70 ? "ok" : "warn"}" style="padding:12px"><div class="label">Maintainability</div><div class="value" style="font-size:22px">${maintainability ? maintainability.toFixed(1) + "%" : "-"}</div><div class="sub">M = 1-e^(-Target/MTTR)</div></div>
      <div class="card kpi warn" style="padding:12px"><div class="label">งาน Priority สูง</div><div class="value" style="font-size:22px">${fmtNumber(highPriority)}</div><div class="sub">ต้องเร่งดำเนินการ</div></div>
    </div>`);
  }

  if (V("statuspct")) {
    parts.push(`
    <div class="grid" style="grid-template-columns:repeat(${Math.max(statusPct.length, 1)}, 1fr);gap:10px;margin-top:10px">
      ${statusPct.map((s) => `
        <div class="card" style="padding:10px;text-align:center">
          <div class="label" style="font-size:11px">${s.label}</div>
          <div class="value mono" style="font-size:18px">${s.pct.toFixed(1)}%</div>
          <div class="sub">${fmtNumber(s.count)} Ticket</div>
        </div>`).join("")}
    </div>`);
  }

  if (V("joblist")) {
    parts.push(`
    <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>รายละเอียดงาน (สำหรับติดตามกับแอดมิน/ช่าง)</span>
      <select id="opsJobStatusSel" style="width:auto;min-width:150px" onchange="onOpsJobStatusChange(this.value)">
        <option value="all">ทุกสถานะ</option>
        ${statusBreakdown.map((s) => `<option value="${s.label}" ${opsJobStatusFilter === s.label ? "selected" : ""}>${s.label} (${s.count})</option>`).join("")}
      </select>
    </div>
    <div class="card" id="opsJobListCard" style="padding:0;overflow:auto;max-height:320px"></div>`);
  }

  if (V("status")) parts.push(breakdownCardHTML("status", "สถานะงาน (Status Ticket) — คลิกแถวเพื่อดูรายละเอียดงานด้านบน", "จำนวน"));
  if (V("priority")) parts.push(breakdownCardHTML("priority", "ระดับความสำคัญ (Priority)", "จำนวน"));
  if (V("issuetype")) parts.push(breakdownCardHTML("issuetype", "ประเภทปัญหา (Issue Type)", "จำนวน"));
  if (V("tickettype")) parts.push(breakdownCardHTML("tickettype", "ประเภทงาน (Ticket Type)", "จำนวน"));
  if (V("building")) parts.push(breakdownCardHTML("building", "อาคาร (จับคู่ Location)", "จำนวน"));
  if (V("area")) parts.push(breakdownCardHTML("area", "พื้นที่ (จับคู่ Area)", "จำนวน"));
  if (V("costtype")) parts.push(breakdownCardHTML("costtype", "ค่าใช้จ่ายรวม แยกตามประเภทปัญหา", "บาท"));
  if (V("anbucket")) parts.push(breakdownCardHTML("anbucket", "การกระจายจำนวนครั้งที่เสียซ้ำ (AN)", "จำนวน Ticket"));

  if (V("costsummary")) {
    parts.push(`
    <div class="section-title">ค่าใช้จ่ายรวม แยกตามหมวดต้นทุน</div>
    <div class="grid cols-4">
      <div class="card kpi" style="padding:10px"><div class="label">รวมทั้งหมด</div><div class="value mono" style="font-size:17px">${fmtNumber(costTotal)}</div></div>
      <div class="card" style="padding:10px"><div class="label">ค่าแรงช่างอาคาร</div><div class="value mono" style="font-size:15px">${fmtNumber(costAH)}</div></div>
      <div class="card" style="padding:10px"><div class="label">ค่าแรง+ค่าซ่อมผู้รับเหมา</div><div class="value mono" style="font-size:15px">${fmtNumber(costAI + costAK)}</div></div>
      <div class="card" style="padding:10px"><div class="label">ค่าอะไหล่+ค่าบริหาร</div><div class="value mono" style="font-size:15px">${fmtNumber(costAJ + costAL)}</div></div>
    </div>`);
  }

  if (V("techperf")) {
    parts.push(`
    <div class="section-title">ผลงานรายช่าง (Top 20)</div>
    <div class="grid cols-3" style="margin-bottom:4px">
      <div class="card" style="padding:10px;height:200px;box-sizing:border-box"><div style="position:relative;width:100%;height:100%"><canvas id="chart_techperf"></canvas></div></div>
      <div class="card" style="padding:10px;height:200px;box-sizing:border-box"><div style="position:relative;width:100%;height:100%"><canvas id="donut_techperf"></canvas></div></div>
      <div class="card" style="padding:0;overflow:auto;height:200px;box-sizing:border-box">
        <table style="font-size:12px;table-layout:fixed;width:100%">
          <colgroup><col style="width:50%"><col style="width:25%"><col style="width:25%"></colgroup>
          <thead><tr><th>ชื่อช่าง</th><th style="text-align:right">จำนวนงาน</th><th style="text-align:right">MTTR (ชม.)</th></tr></thead>
          <tbody>
            ${techRows.slice(0, 20).map((t) => `<tr><td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.name}</td><td class="mono" style="text-align:right">${fmtNumber(t.count)}</td><td class="mono" style="text-align:right">${t.avgMttr ? t.avgMttr.toFixed(1) : "-"}</td></tr>`).join("")}
            ${!techRows.length ? '<tr><td colspan="3" class="empty">ไม่มีข้อมูลช่าง</td></tr>' : ""}
          </tbody>
        </table>
      </div>
    </div>`);
  }

  if (V("repeat")) {
    parts.push(`
    <div class="section-title">จุด/ประเภทงานที่เสียซ้ำบ่อย (≥3 ครั้ง) — พร้อมสิ่งที่เสียซ้ำ (ประมาณการจากข้อความแจ้งซ่อม)</div>
    <div class="grid cols-3" style="margin-bottom:4px">
      <div class="card" style="padding:10px;height:200px;box-sizing:border-box"><div style="position:relative;width:100%;height:100%"><canvas id="chart_repeat"></canvas></div></div>
      <div class="card" style="padding:10px;height:200px;box-sizing:border-box"><div style="position:relative;width:100%;height:100%"><canvas id="donut_repeat"></canvas></div></div>
      <div class="card" style="padding:0;overflow:auto;height:200px;box-sizing:border-box">
        <table style="font-size:12px;table-layout:fixed;width:100%">
          <colgroup><col style="width:28%"><col style="width:18%"><col style="width:14%"><col style="width:40%"></colgroup>
          <thead><tr><th>อาคาร/พื้นที่</th><th>ประเภทปัญหา</th><th style="text-align:right">จำนวน</th><th>สิ่งที่เสียซ้ำบ่อยสุด</th></tr></thead>
          <tbody>
            ${repeatList.map((r) => `<tr><td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.building}</td><td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.issueType}</td><td class="mono" style="text-align:right"><span class="badge rejected">${r.count}</span></td><td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.symptom}</td></tr>`).join("")}
            ${!repeatList.length ? '<tr><td colspan="4" class="empty">ไม่พบจุดที่เสียซ้ำ ≥3 ครั้ง ในตัวกรองนี้</td></tr>' : ""}
          </tbody>
        </table>
      </div>
    </div>
    <div style="padding:4px 4px 10px 4px;font-size:11px;color:var(--text-muted)">
      ⚠️ คอลัมน์ "สิ่งที่เสียซ้ำ" เป็นการค้นคำสำคัญ (เช่น ก๊อกน้ำ, หลอดไฟ) จากข้อความแจ้งซ่อมในกลุ่มเดียวกัน เป็นการประมาณการ ไม่ใช่ค่าที่แม่นยำ 100%
    </div>`);
  }

  body.innerHTML = parts.join("\n");

  if (V("status")) {
    renderBreakdownChartAndTable("status", statusBreakdown, "count", "#5B8DEF", 8);
    const statusTbody = document.getElementById("tbl_status");
    if (statusTbody) {
      Array.from(statusTbody.querySelectorAll("tr")).forEach((tr, idx) => {
        const item = statusBreakdown[idx];
        if (!item) return;
        tr.style.cursor = "pointer";
        tr.onclick = () => onOpsStatusRowClick(item.label);
      });
    }
  }
  if (V("priority")) renderBreakdownChartAndTable("priority", priorityBreak, "count", "#E8A33D", 5);
  if (V("issuetype")) renderBreakdownChartAndTable("issuetype", issueTypeBreak, "count", "#3FA796", 10);
  if (V("tickettype")) renderBreakdownChartAndTable("tickettype", ticketTypeBreak, "count", "#B98CE0", 10);
  if (V("building")) renderBreakdownChartAndTable("building", buildingBreak, "count", "#4FC3E0", 10);
  if (V("area")) renderBreakdownChartAndTable("area", areaBreak, "count", "#E0A24F", 10);
  if (V("costtype")) renderBreakdownChartAndTable("costtype", costByIssueType, "value", "#D9685F", 10);
  if (V("anbucket")) renderBreakdownChartAndTable("anbucket", anBreak, "count", "#7A8CFF", 6);

  if (V("techperf")) {
    const techChartItems = techRows.map((t) => ({ label: t.name, count: t.count }));
    renderBreakdownChartAndTable("techperf", techChartItems, "count", "#5B8DEF", 10);
  }
  if (V("repeat")) {
    const repeatChartItems = repeatList.map((r) => ({ label: `${r.building} | ${r.issueType}`, count: r.count }));
    renderBreakdownChartAndTable("repeat", repeatChartItems, "count", "#D9685F", 10);
  }

  if (V("joblist")) renderOpsJobList(rows);
}
