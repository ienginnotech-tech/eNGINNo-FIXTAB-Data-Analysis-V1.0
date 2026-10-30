// ==========================================================================
// Admin Management V2: อนุมัติ/ปฏิเสธ/เพิกถอน + กำหนด Role + เพิ่มผู้ใช้ + ดู log การนำเข้า
// ==========================================================================

function escHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

async function loadUsers() {
  const tbody = document.querySelector("#tblUsers tbody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty">กำลังโหลด...</td></tr>`;
  const res = await apiCall("listUsers");
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">โหลดไม่สำเร็จ: ${escHtml(res.error)}</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  res.users.forEach((u) => {
    const em = escHtml(u.email);
    const tr = document.createElement("tr");
    const last = u.lastLogin ? new Date(u.lastLogin).toLocaleString("th-TH") : "-";
    tr.innerHTML = `
      <td>${em}</td>
      <td>${escHtml(u.name)}</td>
      <td>
        <select onchange="changeRole('${em}', this.value)">
          ${["user", "manager", "admin"].map((r) => `<option value="${r}" ${u.role === r ? "selected" : ""}>${r}</option>`).join("")}
        </select>
      </td>
      <td><span class="badge ${escHtml(u.status)}">${escHtml(u.status)}</span></td>
      <td class="mono">${last}</td>
      <td>
        ${u.status !== "approved" ? `<button class="btn small" onclick="changeStatus('${em}','approved')">อนุมัติ</button>` : ""}
        ${u.status === "approved" ? `<button class="btn secondary small" onclick="changeStatus('${em}','revoked')">เพิกถอน</button>` : ""}
        ${u.status === "pending" ? `<button class="btn danger small" onclick="changeStatus('${em}','rejected')">ปฏิเสธ</button>` : ""}
      </td>`;
    tbody.appendChild(tr);
  });
}

async function changeStatus(email, status) {
  const res = await apiCall("setStatus", { email, status });
  if (!res.ok) alert(res.error || "ทำรายการไม่สำเร็จ");
  loadUsers();
}

async function changeRole(email, role) {
  const res = await apiCall("setRole", { email, role });
  if (!res.ok) alert(res.error || "เปลี่ยน Role ไม่สำเร็จ");
  loadUsers();
}

async function addUserFromForm() {
  const email = document.getElementById("newEmail").value.trim();
  if (!email) { alert("กรอกอีเมลก่อน"); return; }
  const res = await apiCall("addUser", {
    email, name: document.getElementById("newName").value.trim(), role: document.getElementById("newRole").value,
  });
  if (!res.ok) { alert(res.error || "เพิ่มไม่สำเร็จ"); return; }
  document.getElementById("newEmail").value = ""; document.getElementById("newName").value = "";
  loadUsers();
}

async function loadUploadLog() {
  const tbody = document.querySelector("#tblUploads tbody");
  tbody.innerHTML = `<tr><td colspan="5" class="empty">กำลังโหลด...</td></tr>`;
  const res = await apiCall("listUploads");
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">โหลดไม่สำเร็จ: ${escHtml(res.error)}</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  res.uploads.slice().reverse().forEach((u) => {
    const tr = document.createElement("tr");
    const ts = u.timestamp ? new Date(u.timestamp).toLocaleString("th-TH") : "";
    tr.innerHTML = `<td class="mono">${ts}</td><td>${escHtml(u.username)}</td><td>${escHtml(u.fileName)}</td><td class="mono">${escHtml(u.fileType)}</td><td class="mono">${fmtNumber(u.rowCount)}</td>`;
    tbody.appendChild(tr);
  });
  if (!res.uploads.length) tbody.innerHTML = `<tr><td colspan="5" class="empty">ยังไม่มีประวัติการนำเข้าไฟล์</td></tr>`;
}
