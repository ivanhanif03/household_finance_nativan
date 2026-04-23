# 🏠 Keuangan Nativan

Aplikasi **Progressive Web App (PWA)** untuk pencatatan keuangan rumah tangga keluarga Nativan. Dibangun dengan HTML, CSS, dan JavaScript murni — tanpa framework — dengan backend **Google Apps Script + Google Sheets**.

---

## ✨ Fitur

- 💰 **Catat Transaksi** — Pendapatan & pengeluaran per anggota keluarga
- 🔄 **Pindah Dana** — Transfer antar dompet tanpa mempengaruhi budget bulanan
- 🏦 **Multi Dompet** — Cash, M-Banking (BTN, Mandiri, BRI, BSI), E-Wallet (Gopay, Dana, OVO, dll)
- 📊 **Budget Bulanan** — Set budget, tracking realisasi, carry-over otomatis dari bulan sebelumnya
- 🔔 **Push Notification** — Notif transaksi masuk & peringatan budget 80% / 90% / 100%
- 📤 **Export CSV** — Export data dengan filter kata kunci & rentang tanggal
- 🔍 **Filter & Pencarian** — Cari transaksi berdasarkan kategori, dompet, jenis, atau deskripsi
- 🔐 **Login Password** — Proteksi akses dengan sesi otomatis 1 jam
- 📱 **Installable PWA** — Bisa diinstall di HP seperti aplikasi native, support offline

---

## 📁 Struktur File

```
nativan/
├── index.html        # Markup HTML utama
├── style.css         # Semua styling & tema
├── app.js            # Logic JavaScript & API calls
├── sw.js             # Service Worker (offline + push notif)
├── manifest.json     # PWA manifest
└── assets/
    └── icons/
        ├── icon-192.png
        └── icon-512.png
```

---

## ⚙️ Setup & Konfigurasi

### 1. Google Sheets

Buat spreadsheet baru dengan **2 sheet**:

**Sheet: `Transaksi`**
| Kolom | Isi |
|-------|-----|
| A | Tanggal |
| B | Jenis (Pendapatan / Pengeluaran) |
| C | Kategori |
| D | Deskripsi |
| E | Nominal |
| F | Dompet |
| G | Detail Dompet |
| H | Kepemilikan |

**Sheet: `Budget`**
| Kolom | Isi |
|-------|-----|
| A | periodeKey |
| B | periodeLabel |
| C | Budget |
| D | Realisasi |

---

### 2. Google Apps Script

1. Di Google Sheets, buka **Extensions → Apps Script**
2. Tempel seluruh kode dari file `gas/Code.gs`
3. Klik **Deploy → New Deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Salin URL deployment

---

### 3. Update Config di `app.js`

```js
// Ganti dengan URL deployment GAS kamu
const SCRIPT_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";

// Ganti password sesuai keinginan
const APP_PASSWORD = "passwordkamu";
```

---

### 4. Deploy ke GitHub Pages

1. Push semua file ke repository GitHub
2. Buka **Settings → Pages**
3. Source: **Deploy from a branch → main → / (root)**
4. Akses via `https://username.github.io/nama-repo`

> ⚠️ **Harus HTTPS** agar Push Notification & Service Worker berfungsi.

---

## 🔔 Aktivasi Push Notification

### Android (Chrome)
1. Buka app via browser Chrome
2. Klik banner **"Aktifkan Notifikasi"** yang muncul setelah login
3. Izinkan notifikasi
4. Opsional: tap **"Tambahkan ke layar utama"** untuk install sebagai PWA

### iPhone / iOS
1. Buka di **Safari**
2. Tap tombol **Share → Add to Home Screen**
3. Buka app dari Home Screen
4. Notifikasi aktif di **iOS 16.4+**

### Push Notification dari Server (Opsional)
Untuk notifikasi bahkan saat app tertutup, perlu VAPID key:
1. Generate VAPID key di [vapidkeys.com](https://vapidkeys.com)
2. Ganti konstanta di `app.js`:
```js
const VAPID_PUBLIC_KEY = "YOUR_VAPID_PUBLIC_KEY";
```
3. Implementasikan endpoint di GAS untuk menyimpan push subscription

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Styling | Bootstrap 5.3, Custom CSS |
| Font | Plus Jakarta Sans (Google Fonts) |
| Backend | Google Apps Script |
| Database | Google Sheets |
| Hosting | GitHub Pages |
| PWA | Service Worker, Web App Manifest |
| Notifikasi | Web Notifications API + Push API |

---

## 👨‍👩‍👧 Anggota Keluarga

Kepemilikan transaksi bisa diubah di `index.html` pada elemen `<select id="kepemilikan">`:

```html
<select id="kepemilikan" class="form-select">
  <option value="Ayah">Ayah</option>
  <option value="Ibun">Ibun</option>
  <option value="Izora">Izora</option>
</select>
```

---

## 📝 Lisensi

Proyek pribadi — Keluarga Nativan 🏠

---

<p align="center">Dibuat dengan ❤️ untuk keluarga Nativan</p>
