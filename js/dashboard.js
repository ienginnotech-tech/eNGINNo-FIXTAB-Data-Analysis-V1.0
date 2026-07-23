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

// ---------- ตัวกรองปี/เดือน ----------
let filterYear = "all";
let filterMonth = "all";

const THAI_MONTHS = ["01-ม.ค.", "02-ก.พ.", "03-มี.ค.", "04-เม.ย.", "05-พ.ค.", "06-มิ.ย.",
                      "07-ก.ค.", "08-ส.ค.", "09-ก.ย.", "10-ต.ค.", "11-พ.ย.", "12-ธ.ค."];

// พยายามหา field ที่เป็นวันที่ในแถวข้อมูล แล้วคืนค่า {year, month, day, time} หรือ null ถ้าไม่เจอ
function extractDate(row) {
  for (const key of Object.keys(row)) {
    if (!/date|วันที่|เมื่อ/i.test(key)) continue;
    const v = row[key];
    if (!v) continue;
    if (v instanceof Date && !isNaN(v)) {
      return { year: v.getFullYear(), month: v.getMonth() + 1, day: v.getDate(), time: v.getTime() };
    }
    if (typeof v === "string") {
      // รูปแบบ dd-mm-yyyy (ที่ใช้ในไฟล์วิเคราะห์ทั้งหมด)
      const m1 = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
      if (m1) {
        const day = parseInt(m1[1]), month = parseInt(m1[2]), year = parseInt(m1[3]);
        return { year, month, day, time: new Date(year, month - 1, day).getTime() };
      }
      // รูปแบบ ISO yyyy-mm-dd
      const m2 = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m2) {
        const year = parseInt(m2[1]), month = parseInt(m2[2]), day = parseInt(m2[3]);
        return { year, month, day, time: new Date(year, month - 1, day).getTime() };
      }
    }
    // เผื่อไฟล์เก่าที่เซลล์วันที่ยังไม่ได้จัดรูปแบบ (Excel Date Serial Number ดิบ เช่น 44711)
    if (typeof v === "number" && v > 25000 && v < 60000) {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000)); // Excel epoch (1900) -> JS epoch (1970)
      if (!isNaN(d)) return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), time: d.getTime() };
    }
  }
  return null;
}

// หาคอลัมน์ตัวเลขหลักของตาราง เพื่อใช้เรียงจากมากไปน้อยเมื่อไม่มีวันที่
function findValueKey(row) {
  const keys = Object.keys(row);
  const numericKeys = keys.filter((k) => typeof row[k] === "number");
  if (!numericKeys.length) return null;
  const priority = /cost|amount|total|count|จำนวน|บาท|ticket|เฉลี่ย|รวม/i;
  return numericKeys.find((k) => priority.test(k)) || numericKeys[numericKeys.length - 1];
}

// เรียงข้อมูล: มีวันที่ → ล่าสุดอยู่บนสุด, ไม่มีวันที่ → ค่าตัวเลขหลักมากอยู่บนสุด
function sortTableRows(rows) {
  if (!rows.length) return rows;
  const hasDate = rows.some((r) => extractDate(r));
  if (hasDate) {
    return [...rows].sort((a, b) => {
      const da = extractDate(a), db = extractDate(b);
      const ta = da ? da.time : -Infinity;
      const tb = db ? db.time : -Infinity;
      return tb - ta; // ล่าสุดก่อน
    });
  }
  const key = findValueKey(rows[0]);
  if (!key) return rows;
  return [...rows].sort((a, b) => num(b[key]) - num(a[key]));
}

function collectYears(data) {
  const years = new Set();
  ANALYSIS_FILES.forEach((f) => {
    const fd = data[f.key];
    if (!fd) return;
    Object.values(fd).forEach((rows) => {
      if (!Array.isArray(rows)) return;
      rows.forEach((r) => {
        const d = extractDate(r);
        if (d) years.add(d.year);
      });
    });
  });
  return Array.from(years).sort((a, b) => b - a); // ปีล่าสุดอยู่บนสุด
}

function rowPassesFilter(row) {
  if (filterYear === "all" && filterMonth === "all") return true;
  const d = extractDate(row);
  if (!d) return true; // แถวที่ไม่มีวันที่ (เช่นตารางสรุป) ไม่ถูกกรองออก
  if (filterYear !== "all" && d.year !== parseInt(filterYear)) return false;
  if (filterMonth !== "all" && d.month !== parseInt(filterMonth)) return false;
  return true;
}

function renderFilterBar(data) {
  const years = collectYears(data);
  return `
    <select id="filterYearSel" onchange="setFilter('year', this.value)" style="width:auto;min-width:110px">
      <option value="all">ทุกปี</option>
      ${years.map((y) => `<option value="${y}" ${filterYear == y ? "selected" : ""}>ปี ${y}</option>`).join("")}
    </select>
    <select id="filterMonthSel" onchange="setFilter('month', this.value)" style="width:auto;min-width:130px">
      <option value="all">ทุกเดือน</option>
      ${THAI_MONTHS.map((m, i) => `<option value="${i + 1}" ${filterMonth == i + 1 ? "selected" : ""}>${m}</option>`).join("")}
    </select>
    <button class="btn secondary" onclick="refreshDashboard()" title="โหลดข้อมูลล่าสุดจากเครื่องอีกครั้ง">↻ Refresh</button>
  `;
}

function refreshDashboard() {
  buildDashboard(currentDashboardTab);
}

function setFilter(kind, value) {
  if (kind === "year") filterYear = value;
  if (kind === "month") filterMonth = value;
  buildDashboard(currentDashboardTab);
}

let currentDashboardTab = "overview";

async function buildDashboard(activeTab) {
  const data = await loadStoredData();
  const has = {
    budget_linked: !!data.budget_linked,
    cost_2approaches: !!data.cost_2approaches,
    self_repair: !!data.self_repair,
    capex_opex: !!data.capex_opex,
  };
  const anyData = Object.values(has).some(Boolean);
  const main = document.getElementById("mainContent");
  const tab = activeTab || currentDashboardTab || "overview";
  currentDashboardTab = tab;

  if (!anyData) {
    main.innerHTML = `
      <div class="topbar">
        <div><div class="eyebrow">CAPEX/OPEX Analysis</div><h2>ภาพรวม CAPEX / OPEX</h2></div>
      </div>
      <div class="card empty">
        ยังไม่มีข้อมูล — กรุณาไปที่หน้า <a href="import.html">นำเข้าข้อมูล</a> เพื่ออัปโหลดไฟล์ผลวิเคราะห์ทั้ง 4 ไฟล์ก่อน
      </div>`;
    return;
  }

  // ---- แท็บสลับไฟล์ + ตัวกรองปี/เดือน ----
  const tabsHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div class="auth-tabs" style="max-width:640px;margin-bottom:0">
        ${DASHBOARD_TABS.map(
          (t) => `<button class="${tab === t.key ? "active" : ""}" onclick="switchDashboardTab('${t.key}')">${t.label}</button>`
        ).join("")}
      </div>
      <div style="display:flex;gap:8px">${renderFilterBar(data)}</div>
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

// รวมยอดตามหมวดอุปกรณ์จากข้อมูลดิบ (ticket ที่กรองแล้ว + ธุรกรรมต้นทุนที่กรองแล้ว)
function aggregateCategoryStats(ticketRows, costRows, costKey) {
  const freq = {};
  ticketRows.forEach((r) => { const c = r["category"]; if (!c) return; freq[c] = (freq[c] || 0) + 1; });
  const cost = {}, costCount = {};
  costRows.forEach((r) => {
    const c = r["category"]; if (!c) return;
    cost[c] = (cost[c] || 0) + num(r[costKey]);
    costCount[c] = (costCount[c] || 0) + 1;
  });
  const categories = new Set([...Object.keys(freq), ...Object.keys(cost)]);
  return Array.from(categories).map((c) => ({
    category: c,
    ticket_count: freq[c] || 0,
    cost_count: costCount[c] || 0,
    total_cost: cost[c] || 0,
    avg_cost: costCount[c] ? (cost[c] || 0) / costCount[c] : 0,
  })).sort((a, b) => b.total_cost - a.total_cost);
}

function recomputeCategorySummary(fileData) {
  const stats = aggregateCategoryStats(fileData.rawTicketsByCategory, fileData.rawRMTransactions, "NETAMOUNT (Baht)");
  return stats.map((s) => ({
    "หมวดอุปกรณ์": s.category,
    "จำนวน Ticket (Fixtab)": s.ticket_count,
    "ค่าใช้จ่ายที่ระบุหมวดได้ (บาท)": s.total_cost,
    "ค่าเฉลี่ย/Ticket (บาท)": s.ticket_count ? Math.round(s.total_cost / s.ticket_count) : 0,
  }));
}

function recomputeCategoryThreshold(fileData, originalCategoryExtended) {
  const stats = aggregateCategoryStats(fileData.rawTicketsByCategory, fileData.rawOneoffCosts, "NETAMOUNT (Baht)");
  const refMap = {};
  (originalCategoryExtended || []).forEach((r) => { refMap[r["หมวดอุปกรณ์"]] = r["ราคาเครื่องใหม่โดยประมาณ (บาท) [ต้องกรอก]"]; });
  return stats.map((s) => {
    const refPrice = refMap[s.category] || null;
    const pct = refPrice ? s.avg_cost / refPrice : null;
    const reco = !refPrice ? "รอราคาเครื่องใหม่" : (pct >= 0.3 ? "เข้าเกณฑ์พิจารณา CAPEX" : "OPEX ปกติ");
    return {
      "หมวดอุปกรณ์": s.category,
      "จำนวน Ticket": s.ticket_count,
      "จำนวนครั้งที่ซ่อม (มี PR/PO)": s.cost_count,
      "ค่าซ่อมรวม (บาท)": s.total_cost,
      "ค่าซ่อมเฉลี่ย/ครั้ง (บาท)": Math.round(s.avg_cost),
      "ราคาเครื่องใหม่โดยประมาณ (บาท) [ต้องกรอก]": refPrice,
      "% เทียบราคาใหม่": pct,
      "คำแนะนำเบื้องต้น": reco,
    };
  });
}

// รวมยอด Ticket + ค่าใช้จ่าย จาก linkedTickets แบบสด ตาม field ที่ระบุ (Branch Name / Product Name)
function aggregateBy(rows, field) {
  const map = {};
  rows.forEach((r) => {
    const key = r[field] || "(ไม่ระบุ)";
    if (!map[key]) map[key] = { count: 0, cost: 0 };
    map[key].count += 1;
    map[key].cost += num(r["Total Repair Cost (THB)"]);
  });
  const labelField = field === "Branch Name" ? "Branch Name" : "Product Name";
  return Object.entries(map)
    .map(([k, v]) => ({ [labelField]: k, "No. of Matched Tickets": v.count, "Total Confirmed Cost (THB)": v.cost }))
    .sort((a, b) => b["No. of Matched Tickets"] - a["No. of Matched Tickets"]);
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

  // ไฟล์ Budget Linked: คำนวณ byBranch / byProduct ใหม่สดๆ จาก linkedTickets ที่กรองแล้ว
  let recomputed = null;
  if (key === "budget_linked" && fileData.linkedTickets && fileData.linkedTickets.length) {
    const filteredLinked = fileData.linkedTickets.filter(rowPassesFilter);
    recomputed = { byBranch: aggregateBy(filteredLinked, "Branch Name"), byProduct: aggregateBy(filteredLinked, "Product Name") };
  }
  // ไฟล์ Cost 2 Approaches: คำนวณ Category Summary ใหม่สดๆ จากข้อมูลดิบที่กรองแล้ว
  let recomputedCat2 = null;
  if (key === "cost_2approaches" && fileData.rawTicketsByCategory && fileData.rawTicketsByCategory.length) {
    const ft = fileData.rawTicketsByCategory.filter(rowPassesFilter);
    const fc = (fileData.rawRMTransactions || []).filter(rowPassesFilter);
    recomputedCat2 = recomputeCategorySummary({ rawTicketsByCategory: ft, rawRMTransactions: fc });
  }
  // ไฟล์ CAPEX/OPEX: คำนวณ Category Threshold ใหม่สดๆ จากข้อมูลดิบที่กรองแล้ว
  let recomputedThreshold = null;
  if (key === "capex_opex" && fileData.rawTicketsByCategory && fileData.rawTicketsByCategory.length) {
    const ft = fileData.rawTicketsByCategory.filter(rowPassesFilter);
    const fc = (fileData.rawOneoffCosts || []).filter(rowPassesFilter);
    recomputedThreshold = recomputeCategoryThreshold({ rawTicketsByCategory: ft, rawOneoffCosts: fc }, fileData.categoryExtended);
  }

  Object.keys(fileData).forEach((sheetKey) => {
    const allRows = fileData[sheetKey];
    if (!Array.isArray(allRows)) return;

    // ชีตที่เป็นข้อความล้วน (ไม่มีตาราง) เช่น Methodology, Read Me — เก็บเป็น array ของ string
    if (allRows.length && typeof allRows[0] === "string") {
      html += `<div class="section-title">${sheetKey}</div>`;
      html += `<div class="card" style="max-height:320px;overflow:auto">`;
      allRows.forEach((line) => {
        html += `<div style="font-size:13px;color:${line.trim() === "" ? "transparent" : "var(--text)"};padding:2px 0;white-space:pre-wrap">${line}</div>`;
      });
      html += `</div>`;
      return;
    }

    let rows, filterNote;
    if (recomputed && (sheetKey === "byBranch" || sheetKey === "byProduct")) {
      rows = recomputed[sheetKey];
      filterNote = (filterYear !== "all" || filterMonth !== "all")
        ? ` — คำนวณสดจาก linkedTickets ตามช่วงเวลาที่เลือก (ไม่ใช่ตารางนิ่งจากไฟล์ Excel)`
        : ` — คำนวณสดจาก linkedTickets`;
    } else if (recomputedCat2 && sheetKey === "categorySummary") {
      rows = recomputedCat2;
      filterNote = (filterYear !== "all" || filterMonth !== "all")
        ? ` — คำนวณสดจากข้อมูลดิบตามช่วงเวลาที่เลือก`
        : ` — คำนวณสดจากข้อมูลดิบ`;
    } else if (recomputedThreshold && sheetKey === "categoryExtended") {
      rows = recomputedThreshold;
      filterNote = (filterYear !== "all" || filterMonth !== "all")
        ? ` — คำนวณสดจากข้อมูลดิบตามช่วงเวลาที่เลือก`
        : ` — คำนวณสดจากข้อมูลดิบ`;
    } else if (sheetKey === "dataGaps") {
      rows = sortTableRows(allRows);
      filterNote = ` — ⚠️ ไม่มีคอลัมน์วันที่ในไฟล์ต้นฉบับ (เป็น PR/PO ที่หา Ticket จับคู่ไม่เจอ) จึงกรองตามปี/เดือนไม่ได้ แสดงข้อมูลทั้งหมดเสมอ`;
    } else {
      rows = sortTableRows(allRows.filter(rowPassesFilter));
      filterNote = rows.length !== allRows.length
        ? ` — กรองตามช่วงเวลาที่เลือกแล้ว จาก ${allRows.length.toLocaleString()} แถว`
        : "";
    }

    html += `<div class="section-title">${sheetKey} (${rows.length.toLocaleString()} แถว${filterNote})</div>`;
    if (!rows.length) {
      html += `<div class="card empty">ไม่มีข้อมูลในช่วงเวลาที่เลือก</div>`;
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
  if (v instanceof Date && !isNaN(v)) return v.toLocaleDateString("th-TH", { year: "numeric", month: "2-digit", day: "2-digit" });
  if (typeof v === "number") return fmtNumber(v);
  return String(v);
}

function renderOverviewTab(data) {
  const body = document.getElementById("dashboardBody");
  const filtering = filterYear !== "all" || filterMonth !== "all";

  // ---- KPI: คำนวณจากข้อมูลระดับ Ticket ดิบ (มีวันที่) จะได้กรองตามปี/เดือนได้จริง ----
  let totalTickets = "-", selfRepairPct = "-", confirmedCount = "-", confirmedAmount = "-", capexFlagCount = "-";

  const rawTickets = data.self_repair && data.self_repair.allTicketsClassified ? data.self_repair.allTicketsClassified : [];
  const filteredTickets = rawTickets.filter(rowPassesFilter);
  if (rawTickets.length) {
    totalTickets = fmtNumber(filteredTickets.length);
    const selfCount = filteredTickets.filter((r) => (r["กลุ่ม"] || "").includes("ช่างอาคารเอง")).length;
    selfRepairPct = filteredTickets.length ? ((selfCount / filteredTickets.length) * 100).toFixed(1) + "%" : "0%";
  } else if (data.self_repair && data.self_repair.summary) {
    // เผื่อไฟล์เก่าที่ยังไม่มีชีต All Tickets Classified — ใช้ตัวเลขรวมทั้งช่วงแทน (กรองไม่ได้)
    const s = data.self_repair.summary;
    const total = s.reduce((a, r) => a + num(r["จำนวน Ticket"] ?? r["count"]), 0);
    const selfRow = getRow(s, (r) => (r["กลุ่ม"] || "").includes("ช่างอาคารเอง"));
    totalTickets = fmtNumber(total);
    if (selfRow) selfRepairPct = num(selfRow["% ของ Ticket ที่เสร็จแล้ว (3,631)"] ?? selfRow["pct"]) + "%";
  }

  const linkedRows = (data.budget_linked && data.budget_linked.linkedTickets ? data.budget_linked.linkedTickets : []).filter((r) => r["Ticket Number"]);
  const filteredLinked = linkedRows.filter(rowPassesFilter);
  confirmedCount = fmtNumber(filteredLinked.length);
  confirmedAmount = fmtNumber(filteredLinked.reduce((a, r) => a + num(r["Total Repair Cost (THB)"]), 0));

  const canFilterCategory = data.cost_2approaches && data.cost_2approaches.rawTicketsByCategory && data.cost_2approaches.rawTicketsByCategory.length;
  const canFilterThreshold = data.capex_opex && data.capex_opex.rawTicketsByCategory && data.capex_opex.rawTicketsByCategory.length;

  let thresholdRowsForKPI = null;
  if (canFilterThreshold) {
    const ft = data.capex_opex.rawTicketsByCategory.filter(rowPassesFilter);
    const fc = (data.capex_opex.rawOneoffCosts || []).filter(rowPassesFilter);
    thresholdRowsForKPI = recomputeCategoryThreshold({ rawTicketsByCategory: ft, rawOneoffCosts: fc }, data.capex_opex.categoryExtended);
    capexFlagCount = fmtNumber(thresholdRowsForKPI.filter((r) => (r["คำแนะนำเบื้องต้น"] || "").includes("CAPEX")).length);
  } else if (data.capex_opex && data.capex_opex.categoryExtended) {
    const flagged = data.capex_opex.categoryExtended.filter(
      (r) => (r["คำแนะนำเบื้องต้น"] || "").includes("CAPEX")
    );
    capexFlagCount = fmtNumber(flagged.length);
  }

  body.innerHTML = `
    <div class="topbar">
      <div>
        <div class="eyebrow">CAPEX/OPEX Analysis</div>
        <h2>ภาพรวม CAPEX / OPEX ${filtering ? `<span class="badge pending" style="vertical-align:middle;margin-left:8px">กรองอยู่: ${filterYear !== "all" ? "ปี " + filterYear : "ทุกปี"} / ${filterMonth !== "all" ? THAI_MONTHS[filterMonth - 1] : "ทุกเดือน"}</span>` : ""}</h2>
      </div>
      <div>
        <button class="btn secondary" onclick="exportCombinedCSV()">⬇ Export CSV รวม</button>
        <button class="btn" onclick="exportCombinedJSON()">⬇ Export JSON รวม</button>
      </div>
    </div>

    <div class="grid cols-4">
      <div class="card kpi">
        <div class="label">Ticket ที่ปิดงานแล้ว (วิเคราะห์ลักษณะการซ่อม)</div>
        <div class="value">${totalTickets}</div>
        <div class="sub">${rawTickets.length ? "เฉพาะ Done + Closed — กรองตามช่วงเวลาที่เลือก" : "เฉพาะ Done + Closed — จากไฟล์ SelfRepair_vs_Procured"}</div>
      </div>
      <div class="card kpi warn">
        <div class="label">ซ่อมเองโดยช่างอาคาร</div>
        <div class="value">${selfRepairPct}</div>
        <div class="sub">ไม่มีค่าใช้จ่ายวัสดุ (ประมาณการ)</div>
      </div>
      <div class="card kpi ok">
        <div class="label">Ticket ที่ยืนยันค่าใช้จ่ายตรง</div>
        <div class="value">${confirmedCount}</div>
        <div class="sub">รวม ${confirmedAmount} บาท${filtering ? " (ตามช่วงที่กรอง)" : ""}</div>
      </div>
      <div class="card kpi warn">
        <div class="label">หมวดที่เข้าเกณฑ์ CAPEX</div>
        <div class="value">${capexFlagCount}</div>
        <div class="sub">${canFilterThreshold ? "กรองตามช่วงเวลาที่เลือก" : "จาก Category Threshold (ทั้งช่วงเวลา)"}</div>
      </div>
    </div>

    <div class="section-title">การจำแนกลักษณะ Ticket ที่ซ่อมเสร็จ${filtering && rawTickets.length ? " (ตามช่วงเวลาที่กรอง)" : ""}</div>
    <div class="grid cols-2">
      <div class="card">
        <canvas id="chartClassification" height="220"></canvas>
      </div>
      <div class="card" style="overflow:auto;max-height:320px">
        <table id="tblClassification"><thead><tr><th>กลุ่ม</th><th>จำนวน</th><th>%</th></tr></thead><tbody></tbody></table>
      </div>
    </div>

    <div class="section-title">ค่าซ่อมต่อครั้ง แยกตามหมวดอุปกรณ์ (ไม่รวมสัญญา PM รายปี)${canFilterThreshold ? (filtering ? " — กรองตามช่วงเวลาที่เลือก" : "") : " — ข้อมูลทั้งช่วงเวลา (ไฟล์นี้ยังไม่มีข้อมูลดิบพร้อมวันที่)"}</div>
    <div class="card">
      <canvas id="chartCategory" height="110"></canvas>
    </div>

    <div class="section-title">เกณฑ์ CAPEX vs OPEX รายหมวดอุปกรณ์${canFilterThreshold ? (filtering ? " — กรองตามช่วงเวลาที่เลือก" : "") : " — ข้อมูลทั้งช่วงเวลา"}</div>
    <div class="card" style="overflow:auto">
      <table id="tblThreshold">
        <thead><tr><th>หมวดอุปกรณ์</th><th>Ticket</th><th>ค่าซ่อมเฉลี่ย/ครั้ง</th><th>ราคาเครื่องใหม่</th><th>%</th><th>คำแนะนำ</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  renderClassification(data, filteredTickets);

  // กราฟ Category: ใช้ข้อมูลดิบที่กรองแล้วถ้ามี ไม่งั้น fallback เป็นตารางสรุปนิ่งทั้งช่วงเวลา
  // กราฟ Category "ไม่รวมสัญญา PM รายปี" — ควรใช้ข้อมูลจากไฟล์ CAPEX/OPEX (คัด PM ออกแล้ว) เป็นหลัก
  // ถ้าไม่มีไฟล์นั้น ค่อย fallback ไปใช้ cost_2approaches (ซึ่งรวม PM ด้วย — จะมีหมายเหตุกำกับให้ชัดเจน)
  let catRowsForChart = thresholdRowsForKPI;
  if (!catRowsForChart && canFilterCategory) {
    const ft = data.cost_2approaches.rawTicketsByCategory.filter(rowPassesFilter);
    const fc = (data.cost_2approaches.rawRMTransactions || []).filter(rowPassesFilter);
    catRowsForChart = recomputeCategorySummary({ rawTicketsByCategory: ft, rawRMTransactions: fc });
  }
  renderCategoryChart(data, catRowsForChart);

  renderThresholdTable(data, thresholdRowsForKPI);
}

function renderClassification(data, filteredTickets) {
  let labelKey, countKey, rows;

  if (filteredTickets && filteredTickets.length) {
    // คำนวณสดจาก Ticket ดิบที่กรองแล้ว (รองรับตัวกรองปี/เดือนจริง)
    const counts = {};
    filteredTickets.forEach((r) => {
      const g = r["กลุ่ม"] || "ไม่ระบุ";
      counts[g] = (counts[g] || 0) + 1;
    });
    const total = filteredTickets.length;
    rows = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([g, c]) => ({ กลุ่ม: g, จำนวน: c, "%": ((c / total) * 100).toFixed(1) + "%" }));
    labelKey = "กลุ่ม"; countKey = "จำนวน";
  } else {
    rows = (data.capex_opex && data.capex_opex.classification && data.capex_opex.classification.length)
      ? data.capex_opex.classification
      : (data.self_repair ? data.self_repair.summary : []);
    if (!rows || !rows.length) return;
    labelKey = rows[0]["กลุ่ม"] !== undefined ? "กลุ่ม" : "repair_class";
    countKey = Object.keys(rows[0]).find((k) => k.includes("จำนวน")) || "count";
  }

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

function renderCategoryChart(data, overrideRows) {
  let rows = overrideRows;
  if (!rows) {
    rows = data.capex_opex && data.capex_opex.categoryExtended ? data.capex_opex.categoryExtended : [];
    if (!rows.length && data.cost_2approaches) rows = data.cost_2approaches.categorySummary || [];
  }
  if (!rows.length) return;

  rows = rows.filter((r) => r["หมวดอุปกรณ์"] || r["category"]);
  const labels = rows.map((r) => r["หมวดอุปกรณ์"] || r["category"]);
  const values = rows.map((r) => num(r["ค่าซ่อมรวม (บาท)"] ?? r["ค่าใช้จ่ายที่ระบุหมวดได้ (บาท)"] ?? r["tagged_rm_cost"] ?? r["total_cost"]));

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

function renderThresholdTable(data, overrideRows) {
  const rows = overrideRows || (data.capex_opex ? data.capex_opex.categoryExtended : []);
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
async function exportCombinedJSON() {
  const data = await loadStoredData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, "fixtab_dashboard_export.json");
}

async function exportCombinedCSV() {
  const data = await loadStoredData();
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
