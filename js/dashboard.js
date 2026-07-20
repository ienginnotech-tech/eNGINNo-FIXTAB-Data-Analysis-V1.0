// ==========================================================================
// Dashboard: รวมผลจากไฟล์วิเคราะห์ทั้ง 4 ไฟล์ เป็นภาพเดียว
// ==========================================================================

function num(v) {
  const n = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : v;
  return isNaN(n) ? 0 : n;
}

function getRow(rows, matchFn) {
  return (rows || []).find(matchFn) || null;
}

const DASHBOARD_TABS = [
  { key: "overview", label: "ภาพรวม" },
  { key: "budget_linked", label: "1. Budget Linked" },
  { key: "cost_2approaches", label: "2. Cost 2 Approaches" },
  { key: "self_repair", label: "3. Self Repair vs Procured" },
  { key: "capex_opex", label: "4. CAPEX/OPEX Framework" },
];

function buildDashboard(activeTab) {
  const data = loadStoredData();
  const has = {
    budget_linked: !!data.budget_linked,
    cost_2approaches: !!data.cost_2approaches,
    self_repair: !!data.self_repair,
    capex_opex: !!data.capex_opex,
  };
  const anyData = Object.values(has).some(Boolean);
  const main = document.getElementById("mainContent");
  const tab = activeTab || "overview";

  if (!anyData) {
    main.innerHTML = `
      <div class="topbar">
        <div><div class="eyebrow">Dashboard</div><h2>ภาพรวม CAPEX / OPEX</h2></div>
      </div>
      <div class="card empty">
        ยังไม่มีข้อมูล — กรุณาไปที่หน้า <a href="import.html">นำเข้าข้อมูล</a> เพื่ออัปโหลดไฟล์ผลวิเคราะห์ทั้ง 4 ไฟล์ก่อน
      </div>`;
    return;
  }

  // ---- แท็บสลับไฟล์ ----
  const tabsHTML = `
    <div class="auth-tabs" style="max-width:640px;margin-bottom:20px">
      ${DASHBOARD_TABS.map(
        (t) => `<button class="${tab === t.key ? "active" : ""}" onclick="switchDashboardTab('${t.key}')">${t.label}</button>`
      ).join("")}
    </div>`;
  main.innerHTML = tabsHTML + `<div id="dashboardBody"></div>`;

  if (tab === "overview") {
    renderOverviewTab(data);
  } else {
    renderFileTab(data, tab);
  }
}

function switchDashboardTab(key) {
  buildDashboard(key);
}

// ---------- แท็บรายไฟล์: แสดงตารางดิบทุกตารางที่ parse ได้จากไฟล์นั้น ----------
function renderFileTab(data, key) {
  const body = document.getElementById("dashboardBody");
  const meta = ANALYSIS_FILES.find((f) => f.key === key);
  const fileData = data[key];

  if (!fileData) {
    body.innerHTML = `<div class="card empty">ยังไม่ได้อัปโหลดไฟล์นี้ — ไปที่ <a href="import.html">นำเข้าข้อมูล</a></div>`;
    return;
  }

  const fileName = data[key + "_fileName"] || meta.label;
  const uploadedAt = data[key + "_uploadedAt"] ? new Date(data[key + "_uploadedAt"]).toLocaleString("th-TH") : "-";

  let html = `
    <div class="topbar">
      <div><div class="eyebrow">Import Center</div><h2>${meta.label}</h2></div>
    </div>
    <div class="card" style="margin-bottom:20px">
      <div style="font-size:13px;color:var(--text-muted)">
        ไฟล์: <span class="mono" style="color:var(--text)">${fileName}</span> ·
        อัปโหลดเมื่อ: <span class="mono" style="color:var(--text)">${uploadedAt}</span>
      </div>
    </div>`;

  Object.keys(fileData).forEach((sheetKey) => {
    const rows = fileData[sheetKey];
    if (!Array.isArray(rows)) return;
    html += `<div class="section-title">${sheetKey} (${rows.length.toLocaleString()} แถว)</div>`;
    if (!rows.length) {
      html += `<div class="card empty">ไม่มีข้อมูลในตารางนี้</div>`;
      return;
    }
    const cols = Object.keys(rows[0]);
    html += `<div class="card" style="overflow:auto;max-height:420px"><table><thead><tr>${cols
      .map((c) => `<th>${c}</th>`)
      .join("")}</tr></thead><tbody>`;
    rows.slice(0, 500).forEach((r) => {
      html += `<tr>${cols.map((c) => `<td>${formatCell(r[c])}</td>`).join("")}</tr>`;
    });
    html += `</tbody></table></div>`;
    if (rows.length > 500) {
      html += `<div style="font-size:12px;color:var(--text-muted);margin:6px 0 20px 0">แสดง 500 แถวแรกจากทั้งหมด ${rows.length.toLocaleString()} แถว — ใช้ปุ่ม Export ในแท็บภาพรวมเพื่อดึงข้อมูลทั้งหมด</div>`;
    }
  });

  body.innerHTML = html;
}

function formatCell(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return fmtNumber(v);
  return String(v);
}

function renderOverviewTab(data) {
  const body = document.getElementById("dashboardBody");

  // ---- KPI คำนวณจากไฟล์ที่มี ----
  let totalTickets = "-", selfRepairPct = "-", confirmedCount = "-", confirmedAmount = "-", capexFlagCount = "-";

  if (data.self_repair && data.self_repair.summary) {
    const s = data.self_repair.summary;
    const total = s.reduce((a, r) => a + num(r["จำนวน Ticket"] ?? r["count"]), 0);
    const selfRow = getRow(s, (r) => (r["กลุ่ม"] || "").includes("ช่างอาคารเอง"));
    totalTickets = fmtNumber(total);
    if (selfRow) selfRepairPct = num(selfRow["% ของ Ticket ที่เสร็จแล้ว (3,631)"] ?? selfRow["pct"]) + "%";
  }

  if (data.budget_linked && data.budget_linked.linkedTickets) {
    const rows = data.budget_linked.linkedTickets.filter((r) => r["Ticket Number"]);
    confirmedCount = fmtNumber(rows.length);
    confirmedAmount = fmtNumber(rows.reduce((a, r) => a + num(r["Total Repair Cost (THB)"]), 0));
  }

  if (data.capex_opex && data.capex_opex.categoryExtended) {
    const flagged = data.capex_opex.categoryExtended.filter(
      (r) => (r["คำแนะนำเบื้องต้น"] || "").includes("CAPEX")
    );
    capexFlagCount = fmtNumber(flagged.length);
  }

  body.innerHTML = `
    <div class="topbar">
      <div><div class="eyebrow">Dashboard</div><h2>ภาพรวม CAPEX / OPEX</h2></div>
      <div>
        <button class="btn secondary" onclick="exportCombinedCSV()">⬇ Export CSV รวม</button>
        <button class="btn" onclick="exportCombinedJSON()">⬇ Export JSON รวม</button>
      </div>
    </div>

    <div class="grid cols-4">
      <div class="card kpi">
        <div class="label">Ticket ที่วิเคราะห์แล้ว</div>
        <div class="value">${totalTickets}</div>
        <div class="sub">จากไฟล์ SelfRepair_vs_Procured</div>
      </div>
      <div class="card kpi warn">
        <div class="label">ซ่อมเองโดยช่างอาคาร</div>
        <div class="value">${selfRepairPct}</div>
        <div class="sub">ไม่มีค่าใช้จ่ายวัสดุ (ประมาณการ)</div>
      </div>
      <div class="card kpi ok">
        <div class="label">Ticket ที่ยืนยันค่าใช้จ่ายตรง</div>
        <div class="value">${confirmedCount}</div>
        <div class="sub">รวม ${confirmedAmount} บาท</div>
      </div>
      <div class="card kpi warn">
        <div class="label">หมวดที่เข้าเกณฑ์ CAPEX</div>
        <div class="value">${capexFlagCount}</div>
        <div class="sub">จาก Category Threshold</div>
      </div>
    </div>

    <div class="section-title">การจำแนกลักษณะ Ticket ที่ซ่อมเสร็จ</div>
    <div class="grid cols-2">
      <div class="card">
        <canvas id="chartClassification" height="220"></canvas>
      </div>
      <div class="card" style="overflow:auto;max-height:320px">
        <table id="tblClassification"><thead><tr><th>กลุ่ม</th><th>จำนวน</th><th>%</th></tr></thead><tbody></tbody></table>
      </div>
    </div>

    <div class="section-title">ค่าซ่อมต่อครั้ง แยกตามหมวดอุปกรณ์ (ไม่รวมสัญญา PM รายปี)</div>
    <div class="card">
      <canvas id="chartCategory" height="110"></canvas>
    </div>

    <div class="section-title">เกณฑ์ CAPEX vs OPEX รายหมวดอุปกรณ์</div>
    <div class="card" style="overflow:auto">
      <table id="tblThreshold">
        <thead><tr><th>หมวดอุปกรณ์</th><th>Ticket</th><th>ค่าซ่อมเฉลี่ย/ครั้ง</th><th>ราคาเครื่องใหม่</th><th>%</th><th>คำแนะนำ</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  renderClassification(data);
  renderCategoryChart(data);
  renderThresholdTable(data);
}

function renderClassification(data) {
  const rows = (data.capex_opex && data.capex_opex.classification && data.capex_opex.classification.length)
    ? data.capex_opex.classification
    : (data.self_repair ? data.self_repair.summary : []);
  if (!rows || !rows.length) return;

  const labelKey = rows[0]["กลุ่ม"] !== undefined ? "กลุ่ม" : "repair_class";
  const countKey = Object.keys(rows[0]).find((k) => k.includes("จำนวน")) || "count";

  const tbody = document.querySelector("#tblClassification tbody");
  const palette = ["#3FA796", "#5B8DEF", "#E8A33D", "#8A97A6", "#D9685F", "#B98CE0", "#4FC3E0", "#E0A24F", "#7A8CFF"];
  const labels = [], values = [], colors = [];
  rows.forEach((r, i) => {
    const label = r[labelKey];
    const count = num(r[countKey]);
    if (!label) return;
    labels.push(label);
    values.push(count);
    colors.push(palette[i % palette.length]);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${label}</td><td class="mono">${fmtNumber(count)}</td><td class="mono">${r["%"] ?? r["pct"] ?? ""}</td>`;
    tbody.appendChild(tr);
  });

  new Chart(document.getElementById("chartClassification"), {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      plugins: { legend: { position: "bottom", labels: { color: "#8A97A6", boxWidth: 12, font: { size: 10 } } } },
    },
  });
}

function renderCategoryChart(data) {
  let rows = data.capex_opex && data.capex_opex.categoryExtended ? data.capex_opex.categoryExtended : [];
  if (!rows.length && data.cost_2approaches) rows = data.cost_2approaches.categorySummary || [];
  if (!rows.length) return;

  rows = rows.filter((r) => r["หมวดอุปกรณ์"] || r["category"]);
  const labels = rows.map((r) => r["หมวดอุปกรณ์"] || r["category"]);
  const values = rows.map((r) => num(r["ค่าซ่อมรวม (บาท)"] ?? r["tagged_rm_cost"] ?? r["total_cost"]));

  new Chart(document.getElementById("chartCategory"), {
    type: "bar",
    data: { labels, datasets: [{ label: "ค่าซ่อมรวม (บาท)", data: values, backgroundColor: "#E8A33D" }] },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#8A97A6" }, grid: { color: "#2A3746" } },
        y: { ticks: { color: "#8A97A6", font: { size: 10 } }, grid: { display: false } },
      },
    },
  });
}

function renderThresholdTable(data) {
  const rows = data.capex_opex ? data.capex_opex.categoryExtended : [];
  const tbody = document.querySelector("#tblThreshold tbody");
  if (!rows || !rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">ไม่มีข้อมูล — อัปโหลดไฟล์ Fixtab_CAPEX_OPEX_Framework.xlsx</td></tr>`;
    return;
  }
  rows.forEach((r) => {
    if (!r["หมวดอุปกรณ์"]) return;
    const reco = r["คำแนะนำเบื้องต้น"] || "-";
    const badge = reco.includes("CAPEX")
      ? `<span class="badge rejected">${reco}</span>`
      : reco.includes("รอ")
      ? `<span class="badge pending">${reco}</span>`
      : `<span class="badge approved">${reco}</span>`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r["หมวดอุปกรณ์"]}</td>
      <td class="mono">${fmtNumber(r["จำนวน Ticket"])}</td>
      <td class="mono">${fmtNumber(r["ค่าซ่อมเฉลี่ย/ครั้ง (บาท)"])}</td>
      <td class="mono">${r["ราคาเครื่องใหม่โดยประมาณ (บาท) [ต้องกรอก]"] ? fmtNumber(r["ราคาเครื่องใหม่โดยประมาณ (บาท) [ต้องกรอก]"]) : "—"}</td>
      <td class="mono">${typeof r["% เทียบราคาใหม่"] === "number" ? (r["% เทียบราคาใหม่"] * 100).toFixed(1) + "%" : "-"}</td>
      <td>${badge}</td>`;
    tbody.appendChild(tr);
  });
}

// ---------- Export ----------
function exportCombinedJSON() {
  const data = loadStoredData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, "fixtab_dashboard_export.json");
}

function exportCombinedCSV() {
  const data = loadStoredData();
  const rows = (data.capex_opex && data.capex_opex.categoryExtended) || [];
  if (!rows.length) { alert("ไม่มีข้อมูลตารางหมวดอุปกรณ์ให้ export"); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")]
    .concat(rows.map((r) => headers.map((h) => `"${(r[h] ?? "").toString().replace(/"/g, '""')}"`).join(",")))
    .join("\n");
  downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), "fixtab_category_threshold.csv");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
