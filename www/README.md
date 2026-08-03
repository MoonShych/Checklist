# Checklist App

แอปเช็กลิสต์งานประจำวัน — HTML5 / CSS3 / Vanilla JavaScript ล้วน (ไม่มี Framework หรือ Library ภายนอก)

## วิธีเปิดใช้งาน

**แบบใช้งานทั่วไป:** แตกไฟล์แล้วดับเบิลคลิกเปิด `index.html` ได้ทันที ใช้งานได้ครบทุกฟีเจอร์ (Checklist, ปฏิทิน, สถิติ, ตั้งค่า, เสียง, Animation)

**แบบเปิดผ่านเซิร์ฟเวอร์ (แนะนำสำหรับทดสอบ PWA / Offline / ปุ่มติดตั้งแอป):**
Service Worker ตามมาตรฐานเบราว์เซอร์ **ทำงานได้เฉพาะบน `http://` หรือ `https://`** เท่านั้น (ไม่ทำงานบน `file://`) ดังนั้นถ้าต้องการทดสอบการ Cache แบบออฟไลน์หรือปุ่ม "ติดตั้งแอป" ให้รันผ่านเซิร์ฟเวอร์เล็ก ๆ เช่น

```
npx serve .
# หรือ
python3 -m http.server 8080
```

แล้วเปิด `http://localhost:8080`

## โครงสร้างโปรเจกต์

```
Checklist/
│ index.html
│ manifest.json
│ sw.js
├── css/style.css
├── js/app.js         (state, storage, rendering, event handling)
├── js/animation.js    (page/checkbox/modal animations - transform+opacity เท่านั้น)
├── js/sound.js        (เสียงเอฟเฟกต์ สังเคราะห์ด้วย Web Audio API ไม่ต้องใช้ไฟล์เสียง)
└── assets/icons/       (ไอคอน PWA ทุกขนาดที่จำเป็น)
```

## ข้อมูลจัดเก็บ (LocalStorage)

- `checklist_items_v1` — รายการ Checklist ทั้งหมด
- `checklist_categories_v1` — หมวดหมู่
- `checklist_completions_v1` — บันทึกว่าวันไหนเช็กอะไรไปแล้วบ้าง
- `checklist_streak_v1` — Current / Best streak และวันล่าสุดที่ทำสำเร็จ
- `checklist_settings_v1` — ตั้งค่าเสียง และรูปแบบกราฟเริ่มต้น

## นำไป Build เป็น APK ด้วย Capacitor

โปรเจกต์นี้เป็น static web app ล้วน ๆ จึงนำไปใช้เป็น `webDir` ของ Capacitor ได้ตรง ๆ:

```
npm install @capacitor/core @capacitor/cli
npx cap init "Checklist" "com.yourname.checklist"
# ตั้งค่า webDir ให้ชี้มาที่โฟลเดอร์นี้ แล้ว
npx cap add android
npx cap sync
npx cap open android
```
