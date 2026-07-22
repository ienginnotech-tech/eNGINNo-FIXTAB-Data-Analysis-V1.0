// ==========================================================================
// operations.js — Dashboard ปฏิบัติงาน (MTTR / Maintainability / ค่าใช้จ่าย / ผลงานช่าง)
// ใช้ข้อมูลจาก Main_data_fixtab_analysis_ENRICHED.xlsx (คอลัมน์ X-AN)
// ==========================================================================

// คอลัมน์ (ต้องตรงกับหัวตารางที่ export_enriched.py สร้างไว้เป๊ะ)
const COL = {
  ticket: "Ticket Number", company: "Company Name", branch: "Branch Name",
  reportDate: "Report Date", priority: "Priority", status: "Status Ticket",
  issueType: "Issue Type",
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
};

// SLA เป้าหมาย (ชั่วโมง) ต่อ Priority — แก้ได้ที่นี่ หรือย้ายไปหน้า Settings ทีหลัง
const SLA_TARGET_HOURS = { High: 4, Medium: 24, Low: 72 };
const DEFAULT_SLA = 24;

let opsFilterCompany = "all";
let opsFilterBranch = "all";

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
      <div class="topbar"><div><div class="eyebrow">Operations</div><h2>ภาพรวมงานปฏิบัติการ</h2></div></div>
      <div class="card empty">ยังไม่มีข้อมูล — ไปที่ <a href="import.html">นำเข้าข้อมูล</a> แล้วอัปโหลดไฟล์ Main_data_fixtab_analysis_ENRICHED.xlsx ในขั้นตอนที่ 3</div>`;
    return;
  }

  // ---- ตัวเลือก Company / Branch ----
  const companies = Array.from(new Set(mainData.map((r) => r[COL.company]).filter(Boolean))).sort();
  const branchesForCompany = (company) => {
    const rows = company === "all" ? mainData : mainData.filter((r) => r[COL.company] === company);
    return Array.from(new Set(rows.map((r) => r[COL.branch]).filter(Boolean))).sort();
  };

  const filtered = mainData.filter((r) =>
    (opsFilterCompany === "all" || r[COL.company] === opsFilterCompany) &&
    (opsFilterBranch === "all" || r[COL.branch] === opsFilterBranch)
  );

  main.innerHTML = `
    <div class="topbar">
      <div><div class="eyebrow">Operations</div><h2>ภาพรวมงานปฏิบัติการ</h2></div>
      <div style="display:flex;gap:8px">
        <select id="opsCompanySel" style="width:auto;min-width:220px" onchange="onOpsCompanyChange(this.value)">
          <option value="all">ทุกบริษัท (All Company)</option>
          ${companies.map((c) => `<option value="${c}" ${opsFilterCompany === c ? "selected" : ""}>${c}</option>`).join("")}
        </select>
        <select id="opsBranchSel" style="width:auto;min-width:200px" onchange="onOpsBranchChange(this.value)">
          <option value="all">ทุกสาขา (All Branch)</option>
          ${branchesForCompany(opsFilterCompany).map((b) => `<option value="${b}" ${opsFilterBranch === b ? "selected" : ""}>${b}</option>`).join("")}
        </select>
        <button class="btn secondary" onclick="buildOperationsPage()">↻ Refresh</button>
      </div>
    </div>
    <div id="opsBody"></div>
  `;

  renderOperationsBody(filtered);
}

function onOpsCompanyChange(val) {
  opsFilterCompany = val;
  opsFilterBranch = "all"; // reset สาขาเมื่อเปลี่ยนบริษัท
  buildOperationsPage();
}
function onOpsBranchChange(val) {
  opsFilterBranch = val;
  buildOperationsPage();
}

function renderOperationsBody(rows) {
  const body = document.getElementById("opsBody");

  // ---- KPI พื้นฐาน ----
  const total = rows.length;
  const statusCount = {};
  rows.forEach((r) => { const s = r[COL.status] || "ไม่ระบุ"; statusCount[s] = (statusCount[s] || 0) + 1; });
  const open = (statusCount["New"] || 0) + (statusCount["Pending"] || 0);
  const inProgress = statusCount["In progress"] || 0;
  const closed = (statusCount["Done"] || 0) + (statusCount["Closed"] || 0);
  const highPriority = rows.filter((r) => r[COL.priority] === "High").length;

  // ---- MTTR / Response Time ----
  const mttrVals = rows.map((r) => onum(r[COL.mttr])).filter((v) => v !== null);
  const avgMttr = mttrVals.length ? mttrVals.reduce((a, b) => a + b, 0) / mttrVals.length : null;
  const respVals = rows.map((r) => onum(r[COL.response])).filter((v) => v !== null);
  const avgResp = respVals.length ? respVals.reduce((a, b) => a + b, 0) / respVals.length : null;

  // ---- Maintainability: M = 1 - e^(-Target/MTTR), Target ตาม Priority เฉลี่ยถ่วงน้ำหนัก ----
  const rowsWithMttr = rows.filter((r) => onum(r[COL.mttr]) !== null);
  let maintainability = null;
  if (rowsWithMttr.length && avgMttr) {
    const mVals = rowsWithMttr.map((r) => {
      const target = SLA_TARGET_HOURS[r[COL.priority]] || DEFAULT_SLA;
      const mttr = onum(r[COL.mttr]);
      return 1 - Math.exp(-target / mttr);
    });
    maintainability = (mVals.reduce((a, b) => a + b, 0) / mVals.length) * 100;
  }

  // ---- ค่าใช้จ่าย ----
  const sumCol = (col) => rows.reduce((a, r) => a + (onum(r[col]) || 0), 0);
  const costAH = sumCol(COL.ah), costAI = sumCol(COL.ai), costAJ = sumCol(COL.aj),
        costAK = sumCol(COL.ak), costAL = sumCol(COL.al);
  const costTotal = costAH + costAI + costAJ + costAK + costAL;

  // ---- ผลงานช่าง ----
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

  // ---- จุดที่เสียซ้ำ ----
  const repeatCandidates = rows.filter((r) => onum(r[COL.an]) >= 3);
  const repeatGroups = {};
  repeatCandidates.forEach((r) => {
    const key = `${r[COL.building] || "(ไม่ระบุ)"} | ${r[COL.issueType] || ""}`;
    if (!repeatGroups[key]) repeatGroups[key] = { building: r[COL.building] || "(ไม่ระบุ)", issueType: r[COL.issueType] || "", count: onum(r[COL.an]) };
  });
  const repeatList = Object.values(repeatGroups).sort((a, b) => b.count - a.count).slice(0, 15);

  body.innerHTML = `
    <div class="grid cols-4">
      <div class="card kpi"><div class="label">Work Request ทั้งหมด</div><div class="value">${fmtNumber(total)}</div><div class="sub">Open ${fmtNumber(open)} / In Progress ${fmtNumber(inProgress)} / Closed ${fmtNumber(closed)}</div></div>
      <div class="card kpi ${avgMttr && avgMttr < 24 ? "ok" : "warn"}"><div class="label">MTTR เฉลี่ย</div><div class="value">${avgMttr ? avgMttr.toFixed(1) + " ชม." : "-"}</div><div class="sub">Response Time เฉลี่ย ${avgResp ? avgResp.toFixed(1) + " ชม." : "-"}</div></div>
      <div class="card kpi ${maintainability && maintainability >= 70 ? "ok" : "warn"}"><div class="label">Maintainability</div><div class="value">${maintainability ? maintainability.toFixed(1) + "%" : "-"}</div><div class="sub">M = 1-e^(-Target/MTTR)</div></div>
      <div class="card kpi warn"><div class="label">งาน Priority สูง</div><div class="value">${fmtNumber(highPriority)}</div><div class="sub">ต้องเร่งดำเนินการ</div></div>
    </div>

    <div class="section-title">ค่าใช้จ่ายรวม (ตามหมวด)</div>
    <div class="grid cols-4">
      <div class="card kpi"><div class="label">ค่าใช้จ่ายรวมทั้งหมด</div><div class="value mono" style="font-size:20px">${fmtNumber(costTotal)}</div><div class="sub">บาท</div></div>
      <div class="card"><div class="label">ค่าแรงช่างอาคาร</div><div class="value mono" style="font-size:18px">${fmtNumber(costAH)}</div></div>
      <div class="card"><div class="label">ค่าแรง+ค่าซ่อมผู้รับเหมา</div><div class="value mono" style="font-size:18px">${fmtNumber(costAI + costAK)}</div></div>
      <div class="card"><div class="label">ค่าอะไหล่ + ค่าบริหาร</div><div class="value mono" style="font-size:18px">${fmtNumber(costAJ + costAL)}</div></div>
    </div>
    <div class="card">
      <canvas id="opsCostChart" height="90"></canvas>
    </div>

    <div class="section-title">ผลงานรายช่าง (Top 20)</div>
    <div class="card" style="overflow:auto;max-height:400px">
      <table>
        <thead><tr><th>ชื่อช่าง</th><th>จำนวนงานที่ทำ</th><th>MTTR เฉลี่ย (ชม.)</th></tr></thead>
        <tbody>
          ${techRows.slice(0, 20).map((t) => `<tr><td>${t.name}</td><td class="mono">${fmtNumber(t.count)}</td><td class="mono">${t.avgMttr ? t.avgMttr.toFixed(1) : "-"}</td></tr>`).join("")}
          ${!techRows.length ? '<tr><td colspan="3" class="empty">ไม่มีข้อมูลช่าง</td></tr>' : ""}
        </tbody>
      </table>
    </div>

    <div class="section-title">จุด/ประเภทงานที่เสียซ้ำบ่อย (≥3 ครั้ง)</div>
    <div class="card" style="overflow:auto;max-height:400px">
      <table>
        <thead><tr><th>อาคาร/พื้นที่</th><th>ประเภทปัญหา</th><th>จำนวนครั้งที่เสียซ้ำ</th></tr></thead>
        <tbody>
          ${repeatList.map((r) => `<tr><td>${r.building}</td><td>${r.issueType}</td><td class="mono"><span class="badge rejected">${r.count}</span></td></tr>`).join("")}
          ${!repeatList.length ? '<tr><td colspan="3" class="empty">ไม่พบจุดที่เสียซ้ำ ≥3 ครั้ง ในตัวกรองนี้ (หรือยังไม่มีคอลัมน์ AN)</td></tr>' : ""}
        </tbody>
      </table>
    </div>
  `;

  renderOpsCostChart(costAH, costAI, costAJ, costAK, costAL);
}

function renderOpsCostChart(ah, ai, aj, ak, al) {
  const ctx = document.getElementById("opsCostChart");
  if (!ctx) return;
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["ค่าแรงช่างอาคาร", "ค่าแรงผู้รับเหมา", "ค่าอะไหล่", "ค่าซ่อมผู้รับเหมา", "ค่าบริหารจัดการ"],
      datasets: [{ label: "บาท", data: [ah, ai, aj, ak, al], backgroundColor: ["#E8A33D", "#5B8DEF", "#3FA796", "#D9685F", "#8A97A6"] }],
    },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#8A97A6" }, grid: { color: "#2A3746" } },
        y: { ticks: { color: "#8A97A6" }, grid: { display: false } },
      },
    },
  });
}
