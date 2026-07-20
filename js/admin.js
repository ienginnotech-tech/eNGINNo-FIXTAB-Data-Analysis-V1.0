// ==========================================================================
// Admin Management: อนุมัติ/ปฏิเสธ/เพิกถอนสิทธิ์ผู้ใช้ + ดู log การนำเข้าไฟล์
// ==========================================================================

async function loadUsers() {
  const tbody = document.querySelector("#tblUsers tbody");
  tbody.innerHTML = `<tr><td colspan="4" class="empty">กำลังโหลด...</td></tr>`;
  const res = await apiGet("listUsers");
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">โหลดไม่สำเร็จ: ${res.error}</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  res.users.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.username}</td>
      <td class="mono">${u.role}</td>
      <td><span class="badge ${u.status}">${u.status}</span></td>
      <td>
        ${u.status !== "approved" ? `<button class="btn small" onclick="changeStatus('${u.username}','approveUser')">อนุมัติ</button>` : ""}
        ${u.status !== "revoked" && u.role !== "admin" ? `<button class="btn secondary small" onclick="changeStatus('${u.username}','revokeUser')">เพิกถอน</button>` : ""}
        ${u.status === "pending" ? `<button class="btn danger small" onclick="changeStatus('${u.username}','rejectUser')">ปฏิเสธ</button>` : ""}
      </td>`;
    tbody.appendChild(tr);
  });
}

async function changeStatus(username, action) {
  const res = await apiCall(action, { username });
  if (!res.ok) alert(res.error || "ทำรายการไม่สำเร็จ");
  loadUsers();
}

async function loadUploadLog() {
  const tbody = document.querySelector("#tblUploads tbody");
  tbody.innerHTML = `<tr><td colspan="5" class="empty">กำลังโหลด...</td></tr>`;
  const res = await apiGet("listUploads");
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">โหลดไม่สำเร็จ: ${res.error}</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  res.uploads.slice().reverse().forEach((u) => {
    const tr = document.createElement("tr");
    const ts = u.timestamp ? new Date(u.timestamp).toLocaleString("th-TH") : "";
    tr.innerHTML = `<td class="mono">${ts}</td><td>${u.username}</td><td>${u.fileName}</td><td class="mono">${u.fileType}</td><td class="mono">${fmtNumber(u.rowCount)}</td>`;
    tbody.appendChild(tr);
  });
  if (!res.uploads.length) tbody.innerHTML = `<tr><td colspan="5" class="empty">ยังไม่มีประวัติการนำเข้าไฟล์</td></tr>`;
}
