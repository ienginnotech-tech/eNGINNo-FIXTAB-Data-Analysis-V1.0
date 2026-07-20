# PSD_eNGINNo FIXTAB Analysis V1.0

Web App สำหรับนำเข้าและแสดงผลวิเคราะห์ข้อมูลซ่อมบำรุง Fixtab / งบประมาณ / CAPEX-OPEX
ทำเป็น Static Site (HTML/CSS/JS ล้วน ไม่ต้อง build) + Backend เป็น Google Apps Script (ฟรี)

---

## โครงสร้างระบบ

```
Browser (GitHub Pages)  ──fetch──▶  Google Apps Script Web App  ──▶  Google Sheet (ฐานข้อมูล Users/Uploads)
        │
        └─ ไฟล์ผลวิเคราะห์ (.xlsx) ถูกอ่านในเบราว์เซอร์ด้วย SheetJS แล้วเก็บใน localStorage ของเครื่องผู้ใช้แต่ละคน
```

**ข้อจำกัดที่ควรทราบ:** ข้อมูลไฟล์ที่ import (4 ไฟล์วิเคราะห์) จะถูกเก็บไว้ใน localStorage ของเบราว์เซอร์แต่ละเครื่อง
ไม่ได้ sync ข้ามเครื่อง/ข้ามคนใช้แบบอัตโนมัติ (เพราะ GitHub Pages ไม่มีฐานข้อมูลกลาง) — ทุกคนที่ต้องการดู Dashboard
เดียวกันต้อง import ไฟล์ 4 ไฟล์นั้นในเครื่องตัวเองก่อน 1 ครั้ง ส่วนระบบ Login/Register/Admin ใช้ฐานข้อมูลกลางจริง (Google Sheet)
ทุกคนเห็นตรงกัน

---

## ส่วนที่ 1: ติดตั้ง Backend (Google Apps Script) — ทำครั้งเดียว

1. ไปที่ https://sheets.google.com สร้าง Google Sheet ใหม่ ตั้งชื่อ `FIXTAB_Analysis_DB`
2. เมนู **ส่วนขยาย (Extensions) > Apps Script**
3. ลบโค้ดเดิมทั้งหมดในไฟล์ `Code.gs` แล้ววางโค้ดจากไฟล์ `apps-script/Code.gs` ที่แนบมาแทน
4. กดปุ่ม ▶ รัน (Run) เลือกฟังก์ชัน **setup** แล้วกด Run
   - ครั้งแรกจะขอ Authorize สิทธิ์ → กด Continue → เลือกบัญชี Google ของคุณ → Advanced > Go to (ชื่อโปรเจกต์) (unsafe) > Allow
   - หลังรันเสร็จ กลับไปดูใน Google Sheet จะเห็นชีต `Users` (มีแถว admin) และ `Uploads` ถูกสร้างขึ้น
5. กด **Deploy > New deployment**
   - Select type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - กด Deploy → คัดลอก **Web app URL** (จะขึ้นต้นด้วย `https://script.google.com/macros/s/xxxx/exec`)

> ทุกครั้งที่แก้โค้ด Code.gs ต้องกด Deploy > Manage deployments > แก้ไข (ไอคอนดินสอ) > New version > Deploy ใหม่ ไม่งั้น backend จะยังใช้โค้ดเวอร์ชันเก่า

---

## ส่วนที่ 2: ตั้งค่า Frontend ให้ต่อกับ Backend

1. เปิดไฟล์ `js/config.js`
2. แก้บรรทัด:
   ```js
   const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
   ```
   เป็น URL ที่คัดลอกมาจากขั้นตอนก่อนหน้า เช่น
   ```js
   const API_URL = "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec";
   ```
3. บันทึกไฟล์

---

## ส่วนที่ 3: ขึ้น GitHub Pages (คุณมีบัญชี GitHub อยู่แล้ว)

เปิด Terminal (หรือ Git Bash บน Windows) ในโฟลเดอร์ `fixtab-webapp` แล้วรันทีละคำสั่ง:

```bash
# 1) init git ในโฟลเดอร์นี้ (ถ้ายังไม่เคย)
git init
git add .
git commit -m "Initial commit: PSD_eNGINNo FIXTAB Analysis V1.0"

# 2) สร้าง repo ใหม่บน GitHub ก่อน (ผ่านหน้าเว็บ github.com > New repository)
#    ตั้งชื่อ เช่น fixtab-analysis-webapp แล้วอย่าติ๊ก "Add README" (เพราะเรามีอยู่แล้ว)
#    จากนั้นคัดลอก URL ของ repo เช่น https://github.com/<your-username>/fixtab-analysis-webapp.git

# 3) เชื่อม remote แล้ว push
git branch -M main
git remote add origin https://github.com/<your-username>/fixtab-analysis-webapp.git
git push -u origin main
```

### เปิดใช้งาน GitHub Pages
1. ไปที่หน้า repo บน GitHub > **Settings > Pages**
2. หัวข้อ **Build and deployment** เลือก Source: **Deploy from a branch**
3. Branch: **main** / Folder: **/(root)** > Save
4. รอ 1-2 นาที จะได้ลิงก์ประมาณ:
   ```
   https://<your-username>.github.io/fixtab-analysis-webapp/
   ```
5. ส่งลิงก์นี้ให้ทุกคนในทีมได้เลย — ทุกคนเข้าเว็บนี้แล้ว **สมัครสมาชิก** รอ admin (คุณ) เข้าไปหน้า **Admin Management** เพื่ออนุมัติ

---

## เข้าสู่ระบบครั้งแรก

- Username: `admin`
- Password: `fixtab2026`

**แนะนำให้เปลี่ยนรหัสผ่าน admin หลังติดตั้งเสร็จ** โดยเข้าไปที่ Google Sheet `FIXTAB_Analysis_DB` ชีต `Users`
แล้วรันฟังก์ชันช่วยเปลี่ยนรหัส (หรือแจ้งผมให้เพิ่มปุ่ม "เปลี่ยนรหัสผ่าน" ในหน้า Settings ให้ในเวอร์ชันถัดไป)

---

## การใช้งานประจำวัน

1. Login เข้าระบบ
2. ไปหน้า **นำเข้าข้อมูล** → อัปโหลดไฟล์ต้นฉบับ 6 ไฟล์ (บันทึก log อย่างเดียว) + ไฟล์ผลวิเคราะห์ 4 ไฟล์ (แสดงผลใน Dashboard)
   - ไฟล์ผลวิเคราะห์ 4 ไฟล์ ต้องได้จากการรันสคริปต์วิเคราะห์ Python เดิม (ที่เคยส่งมอบให้) ก่อนทุกครั้งที่มีข้อมูลใหม่
3. ไปหน้า **Dashboard** ดูภาพรวม / กด Export CSV หรือ JSON
4. Admin เข้าหน้า **Admin Management** เพื่ออนุมัติสมาชิกใหม่ และดูประวัติการนำเข้าไฟล์ของทุกคน
5. ปรับสี/ขนาดตัวอักษรได้ที่หน้า **ตั้งค่า**

---

## โครงสร้างไฟล์

```
fixtab-webapp/
├── index.html          # หน้า Login / Register
├── dashboard.html       # หน้าสรุปรายงาน
├── import.html          # หน้านำเข้าข้อมูล
├── admin.html            # หน้า Admin Management
├── settings.html          # หน้าตั้งค่า
├── css/style.css          # ธีมและสไตล์ทั้งหมด
├── js/
│   ├── config.js         # ตั้งค่า API_URL ← แก้ตรงนี้หลัง deploy Apps Script
│   ├── auth.js            # login/register/session
│   ├── app.js              # sidebar + theme loader
│   ├── import.js            # อ่านไฟล์ xlsx ด้วย SheetJS
│   ├── dashboard.js          # รวมข้อมูล + กราฟ
│   └── admin.js               # จัดการผู้ใช้
├── apps-script/Code.gs          # โค้ด backend (วางใน Apps Script)
└── README.md
```

## แนวทางพัฒนาต่อ (ถ้าต้องการ)
- ให้ข้อมูล Dashboard sync ข้ามเครื่องจริง (ไม่ใช่แค่ localStorage) → ต้องเก็บข้อมูลที่ parse แล้วลง Google Sheet
  หรือ Google Drive ผ่าน Apps Script เพิ่มเติม (ปัจจุบันเก็บเฉพาะ log ว่าใครอัปโหลดไฟล์อะไรเมื่อไหร่)
- เพิ่มปุ่มเปลี่ยนรหัสผ่านตัวเองในหน้า Settings
- ตั้งเวลาให้ Apps Script ดึงไฟล์จาก Google Drive อัตโนมัติแทนการอัปโหลดมือทุกครั้ง
