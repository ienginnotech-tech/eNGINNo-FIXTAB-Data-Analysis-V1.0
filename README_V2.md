# V2 — ข้อมูลกลาง + Login ด้วยอีเมล OTP + KEY

## Role
| Role | ทำได้ |
|---|---|
| admin (คุณ) | ทุกอย่าง + จัดการผู้ใช้/Role |
| manager (Chontanut) | นำเข้า/ล้างข้อมูลกลาง + ดูข้อมูล |
| user | ดูข้อมูลอย่างเดียว (ไม่เห็นเมนูนำเข้า) |

## ติดตั้ง Backend
1. Apps Script: วาง `apps-script/Code.gs` ทับของเดิมทั้งหมด → Save
2. เลือกฟังก์ชัน `setup` → Run (อนุญาตสิทธิ์ Sheet + Gmail) → ดู **API KEY** ใน Execution log
3. Deploy → Manage deployments → ดินสอ → Version: New version → Deploy (URL เดิม)
4. ส่ง KEY ให้ทุกคน (ไม่ใส่ใน GitHub) / ลืม KEY: รัน `showApiKey` / เปลี่ยน: รัน `changeApiKey`

## ขึ้น GitHub (อย่าทับ js/config.js)
root: index.html, admin.html, import.html  |  js/: auth.js, storage.js, admin.js, app.js
