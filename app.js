/* =====================================================
   KEUANGAN NATIVAN — app.js
   ===================================================== */

// ─────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────
const SCRIPT_URL  = "https://script.google.com/macros/s/AKfycbx85BqK5LKIzJd9xoxiMkoViIsxBZqYaCJ7cKHhIprcDx6TWVXzyiznYQCvExSjzhRJ/exec";
const APP_PASSWORD = "nativan300424";

// VAPID public key for push notifications
// Ganti dengan VAPID key milikmu (generate via web-push library)
// Bisa generate di: https://vapidkeys.com/
const VAPID_PUBLIC_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBfC7PCjnXR3UjN2bG4kEMXLpkQ";

// ─────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────
let semuaData   = [];
let semuaBudget = [];
let lastBudgetPct = 0; // untuk track perubahan % budget

// ─────────────────────────────────────────────────
// CORE: GAS API call (GET-only, CORS-safe)
// ─────────────────────────────────────────────────
async function gasCall(params) {
  const qs  = new URLSearchParams({ ...params, _t: Date.now() }).toString();
  const url = SCRIPT_URL + "?" + qs;

  console.log("[gasCall] →", params.action);

  const res = await fetch(url, { method: "GET", cache: "no-store" });

  if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (_) {
    throw new Error("Response bukan JSON: " + text.slice(0, 100));
  }
  return json;
}

// ─────────────────────────────────────────────────
// UI HELPERS
// ─────────────────────────────────────────────────
const showLoading = (v) => {
  document.getElementById("loadingOverlay").style.display = v ? "flex" : "none";
};

const formatRupiah = (n) =>
  "Rp " + Math.abs(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const formatTanggal = (t) => {
  const d = new Date(t);
  if (isNaN(d)) return "-";
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

const capitalizeFirst = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

function showToast(msg, duration = 3500, type = "info") {
  const wrap  = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className   = "toast " + type;
  toast.textContent = msg;
  wrap.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, duration);
}

let _overlayBusy = false;
function showOverlayToast(msg = "✅ Berhasil!", dur = 1800) {
  if (_overlayBusy) return;
  _overlayBusy = true;
  const el = document.getElementById("overlayToast");
  el.textContent = msg;
  el.classList.remove("show");
  el.offsetWidth;
  el.classList.add("show");
  setTimeout(() => { el.classList.remove("show"); _overlayBusy = false; }, dur);
}

function showDebug(msg) {
  const p = document.getElementById("debugPanel");
  p.textContent = "DEBUG: " + msg;
  p.classList.add("show");
}

// ─────────────────────────────────────────────────
// FORM: Dompet Detail Options
// ─────────────────────────────────────────────────
const detailOptions = {
  Cash:       ["Cash"],
  "M-Banking":["BTN","Mandiri","BRI","BSI"],
  "E-Wallet": ["Gopay","Dana","OVO","ShopeePay","LinkAja"],
};

function updateDetailDompet() {
  const dompetEl      = document.getElementById("dompet");
  const dompetDetailEl= document.getElementById("dompetDetail");
  const opts = detailOptions[dompetEl.value] || [];
  dompetDetailEl.innerHTML = '<option value="">-- Pilih --</option>';
  opts.forEach(o => {
    const el = document.createElement("option");
    el.value = el.textContent = o;
    dompetDetailEl.appendChild(el);
  });
}

// ─────────────────────────────────────────────────
// SIMPAN TRANSAKSI
// ─────────────────────────────────────────────────
async function simpanTransaksi() {
  const kategori    = document.getElementById("kategori").value.trim();
  const nominal     = document.getElementById("nominal").value.replace(/\./g,"");

  if (!kategori)  return showToast("Kategori wajib diisi!", 3000, "error");
  if (!nominal)   return showToast("Nominal wajib diisi!", 3000, "error");

  const btn = document.getElementById("btnSimpan");
  btn.disabled = true;
  showLoading(true);

  try {
    const result = await gasCall({
      action:       "addTransaksi",
      jenis:        document.getElementById("jenis").value,
      kategori,
      nominal,
      deskripsi:    document.getElementById("deskripsi").value.trim(),
      dompet:       document.getElementById("dompet").value,
      dompetDetail: document.getElementById("dompetDetail").value,
      kepemilikan:  document.getElementById("kepemilikan").value,
    });

    showLoading(false);

    if (result.status === "OK") {
      showOverlayToast("✅ Transaksi tersimpan!");

      // Kirim push notification transaksi baru
      sendLocalNotif(
        "💰 Transaksi Baru",
        `${document.getElementById("jenis").value}: ${document.getElementById("kategori").value} — ${formatRupiah(nominal)}`
      );

      closeModal();
      document.getElementById("kategori").value = "";
      document.getElementById("nominal").value  = "";
      document.getElementById("deskripsi").value = "";
      setTimeout(loadData, 1500);
    } else {
      const errMsg = result.message || "Tidak ada pesan dari GAS";
      showToast("❌ " + errMsg, 5000, "error");
      showDebug(JSON.stringify(result));
    }
  } catch (err) {
    showLoading(false);
    console.error("[simpanTransaksi]", err);
    showToast("❌ Koneksi gagal: " + err.message, 5000, "error");
    showDebug(err.message);
  } finally {
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────
// SPLASH SCREEN HELPERS
// ─────────────────────────────────────────────────
function showSplash() {
  document.getElementById("splashScreen").classList.add("active");
}

function hideSplash() {
  const splash = document.getElementById("splashScreen");
  splash.style.transition = "opacity .5s ease";
  splash.style.opacity    = "0";
  setTimeout(() => {
    splash.classList.remove("active");
    splash.style.opacity = "";
    splash.style.transition = "";
  }, 500);
}

function setSplashProgress(pct, status) {
  document.getElementById("splashBar").style.width = pct + "%";
  document.getElementById("splashPct").textContent = Math.round(pct) + "%";
  if (status) document.getElementById("splashStatus").textContent = status;
}

// ─────────────────────────────────────────────────
// LOAD DATA (dengan splash progress)
// ─────────────────────────────────────────────────
async function loadData(withSplash = false) {
  if (withSplash) {
    showSplash();
    setSplashProgress(10, "Menghubungkan ke server...");
  } else {
    showLoading(true);
  }

  try {
    if (withSplash) setSplashProgress(30, "Mengambil data transaksi...");

    const data = await gasCall({ action: "getData" });

    if (data.status === "ERROR") {
      showToast("❌ GAS error: " + data.message, 5000, "error");
      if (withSplash) hideSplash(); else showLoading(false);
      return;
    }

    if (withSplash) setSplashProgress(65, "Memproses data keuangan...");

    semuaData   = data.transaksi || [];
    semuaBudget = data.budget    || [];

    if (withSplash) setSplashProgress(80, "Menghitung saldo & budget...");

    handleBudgetUI();
    renderDashboard();

    if (withSplash) setSplashProgress(95, "Menyiapkan riwayat transaksi...");

    renderRiwayat(filter3HariTerakhir(semuaData));

    if (withSplash) {
      setSplashProgress(100, "Selesai! ✨");
      // Tunggu sebentar di 100% biar keliatan, lalu hide splash
      setTimeout(() => hideSplash(), 600);
    }

  } catch (err) {
    console.error("[loadData]", err);
    showToast("❌ Gagal load data: " + err.message, 5000, "error");
    if (withSplash) hideSplash();
  }

  if (!withSplash) showLoading(false);
}

// ─────────────────────────────────────────────────
// SET BUDGET
// ─────────────────────────────────────────────────
async function setBudget() {
  const val = document.getElementById("budgetInput").value.replace(/\./g,"");
  if (!val) return showToast("Isi nominal budget dulu!", 3000, "error");

  const now = new Date();
  const btn = document.getElementById("btnBudget");
  btn.disabled = true;
  showLoading(true);

  try {
    const result = await gasCall({
      action: "setBudget",
      bulan:  now.getMonth() + 1,
      tahun:  now.getFullYear(),
      budget: val,
    });

    showLoading(false);

    if (result.status === "OK") {
      showOverlayToast("✅ Budget tersimpan!");
      setTimeout(loadData, 1500);
    } else {
      const errMsg = result.message || "Tidak ada pesan dari GAS";
      showToast("❌ " + errMsg, 5000, "error");
      showDebug(JSON.stringify(result));
    }
  } catch (err) {
    showLoading(false);
    console.error("[setBudget]", err);
    showToast("❌ Koneksi gagal: " + err.message, 5000, "error");
  } finally {
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────
function filter3HariTerakhir(data) {
  const batas = new Date();
  batas.setDate(batas.getDate() - 3);
  return data.filter(t => new Date(t.tanggal) >= batas);
}

function filterTanggal() {
  const s = document.getElementById("startDate").value;
  const e = document.getElementById("endDate").value;
  if (!s || !e) return showToast("Pilih tanggal awal dan akhir!");
  const start = new Date(s);
  const end   = new Date(e);
  end.setHours(23,59,59,999);
  renderRiwayat(semuaData.filter(t => { const d = new Date(t.tanggal); return d >= start && d <= end; }));
}

function renderDashboard() {
  let pendapatan=0, pengeluaran=0, cash=0, bank=0, wallet=0;

  semuaData.forEach(trx => {
    const n = Number(String(trx.nominal).replace(/\./g,"")) || 0;
    const j = String(trx.jenis||"").trim().toLowerCase();
    if (j === "pendapatan") {
      pendapatan += n;
      if (trx.dompet==="Cash") cash+=n; else if (trx.dompet==="M-Banking") bank+=n; else wallet+=n;
    } else if (j === "pengeluaran") {
      pengeluaran += n;
      if (trx.dompet==="Cash") cash-=n; else if (trx.dompet==="M-Banking") bank-=n; else wallet-=n;
    }
  });

  document.getElementById("totalPendapatan").textContent = formatRupiah(pendapatan);
  document.getElementById("totalPengeluaran").textContent = formatRupiah(pengeluaran);
  document.getElementById("saldo").textContent = formatRupiah(pendapatan - pengeluaran);
  document.getElementById("saldoCash").textContent   = formatRupiah(cash);
  document.getElementById("saldoBank").textContent   = formatRupiah(bank);
  document.getElementById("saldoWallet").textContent = formatRupiah(wallet);

  updateBudget();
}

let detailOpen = null;

function toggleDetail(tipe) {
  const detailCont = document.getElementById("detailSaldoContainer");

  if (detailOpen === tipe) {
    detailCont.style.height = "0"; detailOpen = null; return;
  }

  detailCont.innerHTML = "";
  const df = semuaData.filter(t => t.dompet === tipe);

  if (!df.length) {
    detailCont.innerHTML = `<p style="text-align:center;color:white;padding:10px">Tidak ada data ${tipe}</p>`;
  } else {
    const sum = {};
    df.forEach(t => {
      const key = `${t.kepemilikan} – ${t.dompetDetail}`;
      const n = Number(String(t.nominal).replace(/\./g,"")) || 0;
      sum[key] = (sum[key]||0) + (t.jenis.toLowerCase()==="pendapatan"?n:-n);
    });
    Object.entries(sum).forEach(([k,v]) => {
      const c = document.createElement("div");
      c.className = "summary-card mb-2";
      c.innerHTML = `<h6>${k}</h6><h3>${formatRupiah(v)}</h3>`;
      detailCont.appendChild(c);
    });
  }

  detailCont.style.display = "block";
  detailCont.style.height  = detailCont.scrollHeight + "px";
  detailOpen = tipe;
}

function renderRiwayat(data) {
  const c = document.getElementById("riwayatContainer");
  c.innerHTML = "";

  if (!data.length) {
    c.innerHTML = "<p style='text-align:center;padding:24px;color:#6b7280'>Tidak ada transaksi.</p>";
    return;
  }

  data.slice().reverse().forEach((trx, idx) => {
    const jenisClass = (trx.jenis||"").toLowerCase();
    c.innerHTML += `
    <div class="trx-card" style="animation-delay:${idx * 0.04}s">
      <div class="trx-header">
        <h6>
          <span class="trx-badge ${jenisClass}">${trx.jenis}</span>
          ${(trx.kategori||"").toUpperCase()}
        </h6>
        <span class="trx-date">${formatTanggal(trx.tanggal)}</span>
      </div>
      <div class="trx-detail">
        <span class="trx-detail-meta">${trx.kepemilikan} • ${trx.dompet} (${trx.dompetDetail})</span>
        <span class="trx-nominal ${jenisClass}">${formatRupiah(trx.nominal)}</span>
      </div>
      <small class="trx-deskripsi">${capitalizeFirst(trx.deskripsi||"-")}</small>
    </div>`;
  });
}

function filterTable() {
  const kw = document.getElementById("filter").value.toLowerCase();
  renderRiwayat(semuaData.filter(t =>
    (t.kategori+t.dompet+t.jenis+t.deskripsi).toLowerCase().includes(kw)
  ));
}

// ─────────────────────────────────────────────────
// BUDGET UI + NOTIFIKASI BUDGET
// ─────────────────────────────────────────────────
function updateBudget() {
  const now   = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();
  const cur   = semuaBudget.find(b => b.bulan==bulan && b.tahun==tahun);

  if (!cur || !cur.budget) {
    document.getElementById("budgetSisa").textContent = "Belum ada budget bulan ini";
    document.getElementById("budgetBar").style.width  = "0%";
    document.getElementById("budgetWarning").innerHTML= "";
    return;
  }

  const persen = (cur.realisasi / cur.budget) * 100;
  const sisa   = cur.budget - cur.realisasi;

  document.getElementById("budgetSisa").textContent = "Sisa: " + formatRupiah(sisa);
  const bar = document.getElementById("budgetBar");
  bar.style.width = Math.min(persen,100) + "%";

  const warn = document.getElementById("budgetWarning");

  // Cek milestone untuk notifikasi (hanya sekali per milestone per sesi)
  const prevPct = lastBudgetPct;
  lastBudgetPct = persen;

  if (persen >= 100) {
    bar.style.background = "#ef4444";
    warn.innerHTML       = "⚠ Budget HABIS!";
    warn.className       = "budget-warning warning100";
    if (prevPct < 100) notifBudget(100, sisa, persen);
  } else if (persen >= 90) {
    bar.style.background = "#fb923c";
    warn.innerHTML       = "⚠ Budget hampir habis (90%)";
    warn.className       = "budget-warning warning90";
    if (prevPct < 90) notifBudget(90, sisa, persen);
  } else if (persen >= 80) {
    bar.style.background = "#fde047";
    warn.innerHTML       = "⚠ Budget sudah 80%";
    warn.className       = "budget-warning warning80";
    if (prevPct < 80) notifBudget(80, sisa, persen);
  } else {
    bar.style.background = "#4ade80";
    warn.innerHTML       = "Budget bulan ini aman ✓";
    warn.className       = "budget-warning";
  }
}

function handleBudgetUI() {
  const now  = new Date();
  const cur  = semuaBudget.find(b => b.bulan==now.getMonth()+1 && b.tahun==now.getFullYear());
  const inp  = document.getElementById("budgetInput");
  const btn  = document.getElementById("btnBudget");
  if (cur && cur.budget) {
    inp.value       = cur.budget.toString().replace(/\B(?=(\d{3})+(?!\d))/g,".");
    btn.textContent = "Edit";
  } else {
    inp.value       = "";
    btn.textContent = "Set";
  }
}

// ─────────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────────
function exportExcel() {
  let filtered = semuaData.slice();
  const kw     = document.getElementById("filter").value.toLowerCase();
  const sDate  = document.getElementById("startDate").value;
  const eDate  = document.getElementById("endDate").value;

  if (kw) filtered = filtered.filter(t => (t.kategori+t.dompet+t.jenis+t.deskripsi).toLowerCase().includes(kw));
  if (sDate && eDate) {
    const s = new Date(sDate), e = new Date(eDate);
    e.setHours(23,59,59,999);
    filtered = filtered.filter(t => { const d=new Date(t.tanggal); return d>=s&&d<=e; });
  }

  if (!filtered.length) { showToast("Tidak ada data untuk diekspor!"); return; }

  const fmt = t => {
    const d=new Date(t);
    return isNaN(d)?"-":`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  let csv = "Jenis,Kategori,Nominal,Deskripsi,Kepemilikan,Dompet,Detail Dompet,Tanggal\n";
  filtered.forEach(t => {
    csv += `${t.jenis},${t.kategori},${t.nominal},"${t.deskripsi}",${t.kepemilikan},${t.dompet},${t.dompetDetail},${fmt(t.tanggal)}\n`;
  });

  const a = document.createElement("a");
  a.href     = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  a.download = `keuangan_nativan_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ─────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────
function openModal() {
  document.getElementById("debugPanel").classList.remove("show");
  document.getElementById("modalTambah").classList.add("show");
  document.getElementById("modalBackdrop").classList.add("show");
  document.getElementById("kategori").focus();
}

function closeModal() {
  document.getElementById("modalTambah").classList.remove("show");
  document.getElementById("modalBackdrop").classList.remove("show");
}

// ─────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────
function checkPassword() {
  const v = document.getElementById("passwordInput").value;
  if (v === APP_PASSWORD) {
    localStorage.setItem("login_nativan", JSON.stringify({ status:true, time:Date.now() }));
    document.getElementById("loginScreen").style.display = "none";
    loadData(true); // pakai splash screen
    setTimeout(requestNotifPermission, 3000);
  } else {
    document.getElementById("loginError").textContent = "❌ Password salah, coba lagi";
  }
}

// ─────────────────────────────────────────────────
// PUSH NOTIFICATION — Web
// ─────────────────────────────────────────────────

/**
 * Minta izin notifikasi browser
 */
async function requestNotifPermission() {
  if (!("Notification" in window)) {
    console.warn("Browser tidak support Notification");
    return false;
  }

  if (Notification.permission === "granted") {
    updateNotifBanner(false);
    return true;
  }

  if (Notification.permission === "denied") {
    updateNotifBanner(true, "denied");
    return false;
  }

  // Tampilkan banner lembut sebelum minta izin
  updateNotifBanner(true, "ask");
  return false;
}

/**
 * Tampilkan/sembunyikan banner izin notifikasi
 */
function updateNotifBanner(show, state = "ask") {
  const banner = document.getElementById("notifBanner");
  if (!banner) return;

  if (!show) {
    banner.style.display = "none";
    return;
  }

  if (state === "denied") {
    banner.innerHTML = `
      <div class="notif-banner-icon">🔕</div>
      <div class="notif-banner-text">
        <strong>Notifikasi diblokir</strong>
        <span>Aktifkan di pengaturan browser untuk terima notif transaksi</span>
      </div>`;
    banner.style.cursor = "default";
  } else {
    banner.style.display = "flex";
  }
}

/**
 * Dipanggil saat user klik "Izinkan" di banner
 */
async function askNotifPermission() {
  if (!("Notification" in window)) return;

  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    updateNotifBanner(false);
    showToast("🔔 Notifikasi diaktifkan!", 3000, "success");
    // Subscribe ke push jika ada SW
    subscribePush();
  } else {
    updateNotifBanner(true, "denied");
    showToast("Notifikasi diblokir. Ubah di pengaturan browser.", 4000, "warning");
  }
}

/**
 * Kirim notifikasi lokal (via SW atau Notification API langsung)
 */
function sendLocalNotif(title, body, icon = "assets/icons/icon-192.png") {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    // Lewat Service Worker (lebih andal di mobile)
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon,
        badge: icon,
        vibrate: [200, 100, 200],
        tag:  "nativan-trx-" + Date.now(),
        data: { url: window.location.href }
      });
    });
  } else {
    // Fallback langsung
    new Notification(title, { body, icon });
  }
}

/**
 * Notifikasi budget berdasarkan milestone
 */
function notifBudget(pct, sisa, actualPct) {
  const emoji  = pct >= 100 ? "🚨" : pct >= 90 ? "⚠️" : "⚡";
  const title  = `${emoji} Budget Bulanan ${pct >= 100 ? "HABIS!" : pct + "% terpakai"}`;
  const body   = pct >= 100
    ? `Budget bulanan kamu sudah habis! Pengeluaran melebihi batas.`
    : `Sisa budget: ${formatRupiah(sisa)} (${Math.round(actualPct)}% terpakai)`;

  sendLocalNotif(title, body);

  // Juga tampilkan toast in-app
  const toastType = pct >= 100 ? "error" : pct >= 90 ? "warning" : "warning";
  showToast(title + " — " + body, 6000, toastType);
}

/**
 * Subscribe ke Web Push (opsional, perlu VAPID di backend)
 * Untuk sekarang ini adalah placeholder — aktifkan jika ada push server
 */
async function subscribePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Cek apakah sudah subscribe
    let sub = await reg.pushManager.getSubscription();
    if (sub) return; // sudah subscribe

    // Subscribe baru
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log("[Push] Subscribed:", JSON.stringify(sub));
    // TODO: kirim sub ke server/GAS kamu untuk simpan endpoint
    // await gasCall({ action: "savePushSub", sub: JSON.stringify(sub) });

  } catch (err) {
    console.warn("[Push] Subscribe gagal:", err.message);
    // Tidak error fatal — notifikasi lokal tetap jalan
  }
}

/**
 * Helper: convert VAPID key
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ─────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────
window.addEventListener("load", () => {
  // Cek sesi login
  const raw = localStorage.getItem("login_nativan");
  if (raw) {
    try {
      const sess = JSON.parse(raw);
      if (Date.now() - sess.time < 60 * 60 * 1000) {
        document.getElementById("loginScreen").style.display = "none";
        loadData(true); // pakai splash screen
        setTimeout(requestNotifPermission, 3000);
      } else {
        localStorage.removeItem("login_nativan");
      }
    } catch (_) {
      localStorage.removeItem("login_nativan");
    }
  }

  // Refresh sesi timestamp
  localStorage.setItem("login_time", Date.now());

  // Register Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js")
      .then(reg => console.log("[SW] Registered:", reg.scope))
      .catch(err => console.warn("[SW] Failed:", err));
  }

  // Init form listeners
  document.getElementById("dompet").addEventListener("change", updateDetailDompet);
  updateDetailDompet();

  // Format nominal input otomatis
  document.getElementById("nominal").addEventListener("input", e => {
    e.target.value = e.target.value.replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,".");
  });

  document.getElementById("budgetInput").addEventListener("input", e => {
    e.target.value = e.target.value.replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,".");
  });

  // Enter di password input
  document.getElementById("passwordInput").addEventListener("keydown", e => {
    if (e.key === "Enter") checkPassword();
  });

  // Notif banner default tersembunyi sampai dicek
  if ("Notification" in window && Notification.permission === "granted") {
    updateNotifBanner(false);
  }
});
