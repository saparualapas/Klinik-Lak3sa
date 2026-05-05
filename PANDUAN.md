# 📋 PANDUAN SETUP — KLINIK DIGITAL PRO
## Sistem Informasi Kesehatan Terintegrasi

---

## 📦 FILE YANG DITERIMA

```
klinik-digital/
├── index.html       → Tampilan web utama
├── app.js           → Logika aplikasi (JavaScript)
├── Code.gs          → Backend Google Apps Script
├── _redirects       → Config Cloudflare Pages
└── PANDUAN.md       → File ini
```

---

## 🔧 LANGKAH 1: SETUP GOOGLE SPREADSHEET

### 1.1 Buat Spreadsheet Baru
1. Buka **Google Sheets** → [sheets.google.com](https://sheets.google.com)
2. Klik **"+ Blank"** untuk membuat spreadsheet baru
3. Beri nama: **"Klinik Digital - Database"**

### 1.2 Pasang Google Apps Script
1. Di spreadsheet, klik menu **Extensions → Apps Script**
2. Hapus semua kode default yang ada
3. **Copy semua isi file `Code.gs`** dan paste ke editor
4. Klik ikon 💾 **Save** (Ctrl+S)
5. Beri nama project: **"KlinikDigitalBackend"**

### 1.3 Jalankan Inisialisasi
1. Di toolbar Apps Script, pilih function **`initSheets`**
2. Klik tombol ▶️ **Run**
3. Akan muncul dialog izin akses → klik **"Review Permissions"**
4. Pilih akun Google Anda → klik **"Advanced"** → **"Go to KlinikDigitalBackend (unsafe)"**
5. Klik **"Allow"**
6. Setelah selesai, kembali ke spreadsheet — akan terbuat 3 sheet:
   - **users** → data login
   - **patients** → data master pasien
   - **2025** (atau tahun berjalan) → data kunjungan

> 💡 **User default:** username `admin`, password `admin123`
> **Segera ganti password setelah login pertama!**

### 1.4 Deploy sebagai Web App
1. Di Apps Script, klik **"Deploy"** → **"New Deployment"**
2. Klik ⚙️ icon di samping "Type" → pilih **"Web App"**
3. Isi konfigurasi:
   - **Description:** Klinik Digital v1
   - **Execute as:** `Me (email@gmail.com)`
   - **Who has access:** `Anyone` ← **WAJIB pilih ini**
4. Klik **"Deploy"**
5. Copy URL yang muncul (format: `https://script.google.com/macros/s/AKfyc.../exec`)
6. **Simpan URL ini** — akan dipakai di langkah berikutnya

> ⚠️ Setiap kali edit `Code.gs`, buat deployment baru:
> Deploy → **"Manage Deployments"** → Edit → **"New Version"** → Deploy

---

## 🌐 LANGKAH 2: DEPLOY KE CLOUDFLARE PAGES

### 2.1 Via Upload Langsung (Paling Mudah)
1. Buka [pages.cloudflare.com](https://pages.cloudflare.com)
2. Login / daftar akun Cloudflare gratis
3. Klik **"Create a project"** → **"Upload assets"**
4. Beri nama project: `klinik-digital`
5. **Upload 3 file ini** (drag & drop):
   - `index.html`
   - `app.js`
   - `_redirects`
6. Klik **"Deploy site"**
7. Tunggu ~1 menit → situs online! URL format: `klinik-digital.pages.dev`

### 2.2 Via GitHub (Opsional, untuk update mudah)
1. Upload folder ke repository GitHub (baru atau existing)
2. Di Cloudflare Pages → **"Connect to Git"**
3. Pilih repo → Framework preset: **"None"**
4. Build output directory: `/` (kosong)
5. Deploy → setiap push ke GitHub otomatis update

---

## ⚙️ LANGKAH 3: KONFIGURASI API URL DI WEB

1. Buka website yang sudah di-deploy
2. Login dengan `admin` / `admin123`
3. Klik menu **"⚙️ Kelola Sheet"** di sidebar
4. Di bagian **"Konfigurasi API"**, paste URL Web App dari Langkah 1.4
5. Klik **"Simpan"**
6. URL disimpan di browser, jadi hanya perlu diset sekali per perangkat

---

## 📱 CARA PENGGUNAAN SEHARI-HARI

### Saat Pasien Datang:
1. Buka web → Login
2. Cari pasien lewat kolom "Cari Pasien" (No.Reg / No.KTP / Nama)
3. Jika pasien lama → data otomatis terisi, riwayat muncul di kiri
4. Jika pasien baru → klik **"+ Pasien Baru"** untuk reset form
5. Isi data pemeriksaan (keluhan, TD, suhu, BB, diagnosa, therapy)
6. Klik **"💾 SIMPAN DATA KUNJUNGAN"**

### Mengelola Sheet/Tahun:
1. Menu **"⚙️ Kelola Sheet"**
2. Untuk tahun baru: isi nama (misal `2026`) → klik **"+ Buat"**
3. Pilih sheet aktif dari dropdown → klik untuk mengaktifkan
4. Sheet baru otomatis terbuat dengan kolom lengkap di Spreadsheet

---

## 🔐 KEAMANAN

| Fitur | Status |
|-------|--------|
| Login dengan username+password | ✅ |
| Ganti password (verifikasi password lama) | ✅ |
| Multi-user dengan manajemen dari admin | ✅ |
| Data tersimpan di Google Spreadsheet milik Anda | ✅ |
| Tidak ada data ke server pihak ketiga | ✅ |

> ⚠️ Google Apps Script dengan akses "Anyone" artinya siapapun yang punya URL API bisa akses. Pastikan URL API tidak disebarkan. Untuk keamanan lebih, pertimbangkan Google Workspace dengan akses terbatas.

---

## 🛠️ TROUBLESHOOTING

**"Gagal terhubung ke server"**
→ Periksa URL API sudah benar di menu Kelola Sheet
→ Pastikan deployment GAS dipilih "Who has access: Anyone"

**"Login gagal padahal password benar"**
→ Cek sheet "users" di Spreadsheet, pastikan kolom A=username, B=password

**Kolom header tidak muncul di sheet**
→ Jalankan fungsi `initSheets` lagi dari Apps Script

**Data tidak tersimpan**
→ Pastikan sheet aktif sudah dipilih (badge sheet di sidebar tidak "—")
→ Buat deployment baru di GAS jika baru edit kode

---

## 📞 STRUKTUR SPREADSHEET

### Sheet `users`
| Username | Password |
|----------|----------|
| admin | admin123 |

### Sheet `patients`
| No.Reg | No.KTP | No.BPJS | Nama | Umur | JK | Riwayat |
|--------|--------|---------|------|------|-----|---------|

### Sheet `2025` (atau tahun lain)
| No.Reg | Tanggal | Keluhan | TD | Suhu | BB | Diagnosa | Therapy | Keterangan | No.KTP | Nama |
|--------|---------|---------|-----|------|-----|---------|---------|-----------|--------|------|

---

*Klinik Digital Pro — Dibuat dengan ❤️ untuk layanan kesehatan yang lebih baik*
