/* =====================================================
   KEUANGAN NATIVAN — app.js v4
   Fitur: Splash progress, Custom Alert, Pindah Dana,
          Budget periode 25-24, Push Notif tersembunyi
===================================================== */

// ─── CONFIG ───────────────────────────────────────
const SCRIPT_URL   = "https://script.google.com/macros/s/AKfycbx85BqK5LKIzJd9xoxiMkoViIsxBZqYaCJ7cKHhIprcDx6TWVXzyiznYQCvExSjzhRJ/exec";
const APP_PASSWORD = "nativan300424";
const VAPID_KEY    = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBfC7PCjnXR3UjN2bG4kEMXLpkQ";

// ─── STATE ────────────────────────────────────────
let semuaData     = [];
let semuaBudget   = [];
let lastBudgetPct = 0;

// ─── GAS API (GET-only, CORS-safe) ───────────────
async function gasCall(params) {
  const url = SCRIPT_URL + "?" + new URLSearchParams({ ...params, _t: Date.now() });
  const res = await fetch(url, { method:"GET", cache:"no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (_) { throw new Error("Response bukan JSON: " + text.slice(0,100)); }
}

// ─── HELPERS ─────────────────────────────────────
const wait        = ms => new Promise(r => setTimeout(r, ms));
const showLoading = v  => { document.getElementById("loadingOverlay").style.display = v?"flex":"none"; };

const formatRupiah = n =>
  "Rp " + Math.abs(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const formatTanggal = t => {
  const d = new Date(t); if (isNaN(d)) return "-";
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

const capitalizeFirst = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

// ─── TOAST ───────────────────────────────────────
function showToast(msg, duration=3500, type="info") {
  const icons = { info:"💬", success:"✅", error:"🚨", warning:"⚠️" };
  const wrap  = document.getElementById("toastContainer");

  // Hapus emoji di awal pesan supaya tidak double
  const cleanMsg = msg.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27FF}\s]+/u, "").trim();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || "💬"}</span>
    <span class="toast-msg">${cleanMsg}</span>
  `;
  wrap.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("show"));
  });

  setTimeout(() => {
    toast.style.transition = "opacity .3s ease, transform .3s ease";
    toast.style.opacity    = "0";
    toast.style.transform  = "translateY(-10px) scale(.9)";
    toast.addEventListener("transitionend", () => toast.remove(), {once:true});
  }, duration);
}

let _obBusy = false;
function showOverlayToast(msg="✅ Berhasil!", dur=1800) {
  if (_obBusy) return; _obBusy = true;
  const el = document.getElementById("overlayToast");
  el.textContent = msg; el.classList.remove("show"); el.offsetWidth; el.classList.add("show");
  setTimeout(() => { el.classList.remove("show"); _obBusy = false; }, dur);
}

// ─── SUCCESS NOTIFICATION (kekinian) ─────────────
let _snTimer = null;
function showSuccessNotif(icon, label, kategori, nominal, dur=3800) {
  // Buat/reuse elemen
  let el = document.getElementById("successNotif");
  if (!el) {
    el = document.createElement("div");
    el.id = "successNotif";
    el.className = "success-notif";
    el.innerHTML = `
      <div class="sn-icon-wrap"><div class="sn-icon" id="snIcon"></div></div>
      <div class="sn-body">
        <div class="sn-label"   id="snLabel"></div>
        <div class="sn-kategori" id="snKategori"></div>
        <div class="sn-nominal"  id="snNominal"></div>
        <div class="sn-progress"><div class="sn-progress-bar" id="snBar"></div></div>
      </div>`;
    document.body.appendChild(el);
  }

  // Reset animasi progress bar
  const bar = document.getElementById("snBar");
  bar.style.animation = "none"; bar.offsetWidth;
  bar.style.setProperty("--sn-dur", dur+"ms");
  bar.style.animation = `sn-drain ${dur}ms linear forwards`;

  document.getElementById("snIcon").textContent     = icon;
  document.getElementById("snLabel").textContent    = label;
  document.getElementById("snKategori").textContent = kategori;
  document.getElementById("snNominal").innerHTML    = `<span>${formatRupiah(nominal)}</span>`;

  el.classList.remove("hide","show");
  el.offsetWidth;
  el.classList.add("show");

  if (_snTimer) clearTimeout(_snTimer);
  _snTimer = setTimeout(() => {
    el.classList.remove("show");
    el.classList.add("hide");
  }, dur);
}

// ─── CUSTOM ALERT ────────────────────────────────
/**
 * showAlert({ icon, title, message, buttons: [{label, type, onClick}] })
 * type: 'primary' | 'secondary' | 'danger' | 'success'
 */
function showAlert({ icon="ℹ️", title="", message="", buttons=[] }) {
  document.getElementById("alertIconWrap").textContent = icon;
  document.getElementById("alertTitle").textContent    = title;
  document.getElementById("alertMessage").textContent  = message;

  const actionsEl = document.getElementById("alertActions");
  actionsEl.innerHTML = "";

  (buttons.length ? buttons : [{label:"OK", type:"primary"}]).forEach(btn => {
    const b = document.createElement("button");
    b.className   = `alert-btn ${btn.type || "primary"}`;
    b.textContent = btn.label;
    b.onclick = () => {
      closeAlert();
      if (btn.onClick) btn.onClick();
    };
    actionsEl.appendChild(b);
  });

  document.getElementById("alertBackdrop").classList.add("show");
  document.getElementById("alertModal").classList.add("show");
}

function closeAlert() {
  document.getElementById("alertBackdrop").classList.remove("show");
  document.getElementById("alertModal").classList.remove("show");
}

// ─── SPLASH ──────────────────────────────────────
function showSplash() {
  const bar    = document.getElementById("splashBar");
  bar.style.transition = "none";
  bar.style.width      = "0%";
  document.getElementById("splashPct").textContent    = "0%";
  document.getElementById("splashStatus").textContent = "Mempersiapkan aplikasi...";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bar.style.transition = "width .45s cubic-bezier(.4,0,.2,1)";
    document.getElementById("splashScreen").classList.add("active");
  }));
}

function hideSplash() {
  document.getElementById("splashScreen").classList.remove("active");
}

function setSplash(pct, status) {
  requestAnimationFrame(() => {
    document.getElementById("splashBar").style.width = pct + "%";
    document.getElementById("splashPct").textContent = Math.round(pct) + "%";
    if (status) document.getElementById("splashStatus").textContent = status;
  });
}

// ─── LOAD DATA ───────────────────────────────────
async function loadData(withSplash=false) {
  if (withSplash) {
    showSplash();
    await wait(350);
    setSplash(20, "Menghubungkan ke server...");
    await wait(200);
    setSplash(38, "Mengambil data transaksi...");
  } else {
    showLoading(true);
  }

  try {
    const data = await gasCall({ action:"getData" });

    if (data.status === "ERROR") {
      showToast("❌ " + data.message, 5000, "error");
      withSplash ? hideSplash() : showLoading(false);
      return;
    }

    if (withSplash) { setSplash(65, "Memproses data keuangan..."); await wait(180); }

    semuaData   = data.transaksi || [];
    semuaBudget = data.budget    || [];

    if (withSplash) { setSplash(82, "Menghitung saldo & budget..."); await wait(150); }

    handleBudgetUI();
    renderDashboard();

    if (withSplash) { setSplash(95, "Menyiapkan riwayat transaksi..."); await wait(150); }

    renderRiwayat(filter3HariTerakhir(semuaData));

    if (withSplash) {
      setSplash(100, "Siap! ✨");
      await wait(600);
      hideSplash();
    }
  } catch(err) {
    console.error("[loadData]", err);
    showToast("❌ Gagal load: " + err.message, 5000, "error");
    withSplash ? hideSplash() : null;
  }

  if (!withSplash) showLoading(false);
}

// ─── PERIODE BUDGET (25–24) ───────────────────────
/**
 * Kembalikan {start: Date, end: Date, label: string}
 * untuk periode aktif berdasarkan tanggal hari ini.
 * Periode = tgl 25 bln X  s/d  tgl 24 bln X+1
 */
function getPeriodeBudget(now = new Date()) {
  const d = now.getDate();
  let periodeStart, periodeEnd;

  if (d >= 25) {
    // Sudah lewat tanggal 25 → periode bulan ini ke bulan depan
    periodeStart = new Date(now.getFullYear(), now.getMonth(), 25);
    periodeEnd   = new Date(now.getFullYear(), now.getMonth()+1, 24, 23, 59, 59, 999);
  } else {
    // Belum tanggal 25 → periode bulan lalu ke bulan ini
    periodeStart = new Date(now.getFullYear(), now.getMonth()-1, 25);
    periodeEnd   = new Date(now.getFullYear(), now.getMonth(), 24, 23, 59, 59, 999);
  }

  const bulanNama = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const label = `25 ${bulanNama[periodeStart.getMonth()]} – 24 ${bulanNama[periodeEnd.getMonth()]} ${periodeEnd.getFullYear()}`;

  return { start: periodeStart, end: periodeEnd, label };
}

/**
 * Key unik periode untuk storage budget: "YYYY-MM-periodeStart"
 * Contoh: "2025-05-25" = periode yang mulai 25 Mei 2025
 */
function getPeriodeKey(periodeStart) {
  return `${periodeStart.getFullYear()}-${String(periodeStart.getMonth()+1).padStart(2,"0")}-25`;
}

// ─── SIMPAN TRANSAKSI ────────────────────────────
async function simpanTransaksi() {
  const kategori  = document.getElementById("kategori").value.trim();
  const nominal   = document.getElementById("nominal").value.replace(/\./g,"");

  if (!kategori) {
    showAlert({ icon:"⚠️", title:"Kategori Kosong", message:"Masukkan kategori transaksi terlebih dahulu.", buttons:[{label:"OK", type:"primary"}] });
    return;
  }
  if (!nominal) {
    showAlert({ icon:"⚠️", title:"Nominal Kosong", message:"Masukkan nominal transaksi terlebih dahulu.", buttons:[{label:"OK", type:"primary"}] });
    return;
  }

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
      const jenis = document.getElementById("jenis").value;
      const ikon  = jenis === "Pendapatan" ? "💰" : "💸";
      const label = jenis === "Pendapatan" ? "Pendapatan Tercatat ✓" : "Pengeluaran Tercatat ✓";
      showSuccessNotif(ikon, label, kategori, nominal);
      sendLocalNotif("💰 Transaksi Baru", `${jenis}: ${kategori} — ${formatRupiah(nominal)}`);
      closeModal();
      document.getElementById("kategori").value  = "";
      document.getElementById("nominal").value   = "";
      document.getElementById("deskripsi").value = "";
      await wait(800);
      loadData();
    } else {
      showAlert({ icon:"❌", title:"Gagal Menyimpan", message: result.message || "Terjadi kesalahan pada server.", buttons:[{label:"Tutup", type:"danger"}] });
    }
  } catch(err) {
    showLoading(false);
    showAlert({ icon:"📡", title:"Koneksi Bermasalah", message:"Gagal terhubung ke server: " + err.message, buttons:[{label:"Tutup", type:"danger"}] });
  } finally {
    btn.disabled = false;
  }
}

// ─── PINDAH DANA (TRANSFER) ──────────────────────
async function simpanTransfer() {
  const nominal         = document.getElementById("trfNominal").value.replace(/\./g,"");
  const dariKepemilikan = document.getElementById("trfDariKepemilikan").value;
  const dariDompet      = document.getElementById("trfDariDompet").value;
  const dariDetail      = document.getElementById("trfDariDetail").value;
  const keKepemilikan   = document.getElementById("trfKeKepemilikan").value;
  const keDompet        = document.getElementById("trfKeDompet").value;
  const keDetail        = document.getElementById("trfKeDetail").value;
  const catatan         = document.getElementById("trfCatatan").value.trim();

  if (!nominal) {
    showAlert({ icon:"⚠️", title:"Nominal Kosong", message:"Masukkan nominal yang ingin dipindahkan.", buttons:[{label:"OK", type:"primary"}] });
    return;
  }
  if (!dariDetail) {
    showAlert({ icon:"⚠️", title:"Pilih Asal", message:"Pilih detail dompet asal dana.", buttons:[{label:"OK", type:"primary"}] });
    return;
  }
  if (!keDetail) {
    showAlert({ icon:"⚠️", title:"Pilih Tujuan", message:"Pilih detail dompet tujuan dana.", buttons:[{label:"OK", type:"primary"}] });
    return;
  }
  if (dariDompet===keDompet && dariDetail===keDetail && dariKepemilikan===keKepemilikan) {
    showAlert({ icon:"⚠️", title:"Sama Persis", message:"Dompet asal dan tujuan tidak boleh sama persis.", buttons:[{label:"OK", type:"primary"}] });
    return;
  }

  const btn = document.getElementById("btnTransfer");
  btn.disabled = true;
  showLoading(true);

  try {
    const result = await gasCall({
      action: "addTransfer",
      nominal,
      dariKepemilikan, dariDompet, dariDetail,
      keKepemilikan,   keDompet,   keDetail,
      catatan,
    });

    showLoading(false);

    if (result.status === "OK") {
      showSuccessNotif("🔄", "Pindah Dana", `${dariKepemilikan}→${keKepemilikan} • ${dariDetail} → ${keDetail}`, nominal);
      sendLocalNotif("🔄 Pindah Dana", `${dariDetail} → ${keDetail}: ${formatRupiah(nominal)}`);
      closeModal();
      document.getElementById("trfNominal").value = "";
      document.getElementById("trfCatatan").value = "";
      await wait(800);
      loadData();
    } else {
      showAlert({ icon:"❌", title:"Transfer Gagal", message: result.message || "Terjadi kesalahan.", buttons:[{label:"Tutup", type:"danger"}] });
    }
  } catch(err) {
    showLoading(false);
    showAlert({ icon:"📡", title:"Koneksi Bermasalah", message:err.message, buttons:[{label:"Tutup", type:"danger"}] });
  } finally {
    btn.disabled = false;
  }
}

// ─── SET BUDGET ──────────────────────────────────
async function setBudget() {
  const val = document.getElementById("budgetInput").value.replace(/\./g,"");
  if (!val) {
    showAlert({ icon:"⚠️", title:"Nominal Kosong", message:"Masukkan nominal budget terlebih dahulu.", buttons:[{label:"OK", type:"primary"}] });
    return;
  }

  const periode = getPeriodeBudget();
  const key     = getPeriodeKey(periode.start);
  const btn     = document.getElementById("btnBudget");
  btn.disabled  = true;
  showLoading(true);

  try {
    const result = await gasCall({
      action:       "setBudget",
      periodeKey:   key,
      periodeLabel: periode.label,
      // backward-compat dengan GAS lama yang pakai bulan/tahun
      bulan:  periode.start.getMonth() + 1,
      tahun:  periode.start.getFullYear(),
      budget: val,
    });

    showLoading(false);

    if (result.status === "OK") {
      showSuccessNotif("📊", "Budget Tersimpan ✓", periode.label, val);
      await wait(800);
      loadData();
    } else {
      showAlert({ icon:"❌", title:"Gagal Menyimpan Budget", message: result.message || "Terjadi kesalahan.", buttons:[{label:"Tutup", type:"danger"}] });
    }
  } catch(err) {
    showLoading(false);
    showAlert({ icon:"📡", title:"Koneksi Bermasalah", message:err.message, buttons:[{label:"Tutup", type:"danger"}] });
  } finally {
    btn.disabled = false;
  }
}

// ─── RENDER DASHBOARD ────────────────────────────
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
    } else if (j === "transfer-keluar") {
      if (trx.dompet==="Cash") cash-=n; else if (trx.dompet==="M-Banking") bank-=n; else wallet-=n;
    } else if (j === "transfer-masuk") {
      if (trx.dompet==="Cash") cash+=n; else if (trx.dompet==="M-Banking") bank+=n; else wallet+=n;
    }
  });
  document.getElementById("totalPendapatan").textContent  = formatRupiah(pendapatan);
  document.getElementById("totalPengeluaran").textContent = formatRupiah(pengeluaran);
  document.getElementById("saldo").textContent            = formatRupiah(pendapatan - pengeluaran);
  document.getElementById("saldoCash").textContent        = formatRupiah(cash);
  document.getElementById("saldoBank").textContent        = formatRupiah(bank);
  document.getElementById("saldoWallet").textContent      = formatRupiah(wallet);
  updateBudget();
}

// ─── BUDGET UI (periode 25–24) ───────────────────
function handleBudgetUI() {
  const periode = getPeriodeBudget();
  const key     = getPeriodeKey(periode.start);
  const cur     = semuaBudget.find(b => b.periodeKey === key);
  const inp     = document.getElementById("budgetInput");
  const btn     = document.getElementById("btnBudget");
  const pEl     = document.getElementById("budgetPeriod");

  if (pEl) pEl.textContent = "📅 " + periode.label;

  if (cur && cur.budget) {
    inp.value       = cur.budget.toString().replace(/\B(?=(\d{3})+(?!\d))/g,".");
    btn.textContent = "Edit";
  } else {
    inp.value       = "";
    btn.textContent = "Set";
  }
}

function updateBudget() {
  const periode = getPeriodeBudget();
  const key     = getPeriodeKey(periode.start);
  const cur     = semuaBudget.find(b => b.periodeKey === key);

  // Hitung realisasi dari transaksi pengeluaran dalam periode aktif
  let realisasi = 0;
  semuaData.forEach(t => {
    const tgl = new Date(t.tanggal);
    if (tgl >= periode.start && tgl <= periode.end && String(t.jenis).toLowerCase() === "pengeluaran") {
      realisasi += Number(String(t.nominal).replace(/\./g,"")) || 0;
    }
  });

  if (!cur || !cur.budget) {
    document.getElementById("budgetSisa").textContent   = "Belum ada budget periode ini";
    document.getElementById("budgetBar").style.width    = "0%";
    document.getElementById("budgetWarning").innerHTML  = "";
    return;
  }

  const persen = (realisasi / cur.budget) * 100;
  const sisa   = cur.budget - realisasi;
  document.getElementById("budgetSisa").textContent = "Sisa: " + formatRupiah(sisa);

  const bar  = document.getElementById("budgetBar");
  bar.style.width = Math.min(persen, 100) + "%";

  const warn = document.getElementById("budgetWarning");
  const prevPct = lastBudgetPct;
  lastBudgetPct = persen;

  if (persen >= 100) {
    bar.style.background = "#ef4444";
    warn.innerHTML       = "🚨 Budget HABIS!";
    warn.className       = "budget-warning warning100";
    if (prevPct < 100) notifBudget(100, sisa, persen);
  } else if (persen >= 90) {
    bar.style.background = "#fb923c";
    warn.innerHTML       = "⚠️ Budget hampir habis (90%)";
    warn.className       = "budget-warning warning90";
    if (prevPct < 90) notifBudget(90, sisa, persen);
  } else if (persen >= 80) {
    bar.style.background = "#fde047";
    warn.innerHTML       = "⚡ Budget sudah 80%";
    warn.className       = "budget-warning warning80";
    if (prevPct < 80) notifBudget(80, sisa, persen);
  } else {
    bar.style.background = "#4ade80";
    warn.innerHTML       = "Budget periode ini aman ✓";
    warn.className       = "budget-warning";
  }
}

// ─── TOGGLE DETAIL SALDO (bottom sheet) ──────────
const avatarMap = { Ayah:"👨", Ibun:"👩", Izora:"👧" };
const avatarBg  = { Ayah:"#dbeafe", Ibun:"#fce7f3", Izora:"#fef9c3" };
const avatarColor = { Ayah:"#1e40af", Ibun:"#9d174d", Izora:"#713f12" };

function toggleDetail(tipe) {
  const ikon  = { Cash:"💵", "M-Banking":"🏦", "E-Wallet":"📱" }[tipe] || "💰";
  const title = document.getElementById("detailSheetTitle");
  const body  = document.getElementById("detailSheetBody");
  title.textContent = `${ikon} Detail ${tipe}`;
  body.innerHTML    = "";

  const df = semuaData.filter(t => t.dompet === tipe);

  if (!df.length) {
    body.innerHTML = `<div style="text-align:center;padding:40px;color:#9ca3af"><div style="font-size:2.5rem;margin-bottom:8px">🪹</div><p>Belum ada transaksi di ${tipe}</p></div>`;
  } else {
    // Kelompokkan per dompetDetail, lalu per kepemilikan
    const byDetail = {};
    df.forEach(t => {
      const det = t.dompetDetail || "Tidak Ada";
      if (!byDetail[det]) byDetail[det] = {};
      const prs = t.kepemilikan || "Umum";
      if (!byDetail[det][prs]) byDetail[det][prs] = 0;
      const n = Number(String(t.nominal).replace(/\./g,"")) || 0;
      const j = String(t.jenis||"").toLowerCase();
      byDetail[det][prs] += (j==="pendapatan"||j==="transfer-masuk") ? n : -n;
    });

    Object.entries(byDetail).forEach(([det, persons]) => {
      const groupTotal = Object.values(persons).reduce((a,b)=>a+b,0);
      const g = document.createElement("div");
      g.className = "detail-wallet-group";
      g.innerHTML = `<div class="detail-wallet-label">${det}</div>`;

      Object.entries(persons).forEach(([prs, val]) => {
        const row = document.createElement("div");
        row.className = "detail-person-row";
        row.innerHTML = `
          <div class="detail-person-info">
            <div class="detail-person-avatar" style="background:${avatarBg[prs]||"#f3f4f6"};color:${avatarColor[prs]||"#374151"}">${avatarMap[prs]||"👤"}</div>
            <div>
              <div class="detail-person-name">${prs}</div>
              <div class="detail-person-sub">${det}</div>
            </div>
          </div>
          <div class="detail-person-amount ${val>=0?"positive":"negative"}">${val<0?"- ":""}${formatRupiah(Math.abs(val))}</div>`;
        g.appendChild(row);
      });

      const totalRow = document.createElement("div");
      totalRow.className = "detail-total-row";
      totalRow.innerHTML = `<span class="detail-total-label">Total ${det}</span><span class="detail-total-amount">${formatRupiah(groupTotal)}</span>`;
      g.appendChild(totalRow);
      body.appendChild(g);
    });
  }

  document.getElementById("detailBackdrop").classList.add("show");
  document.getElementById("detailSheet").classList.add("show");
}

function closeDetail() {
  document.getElementById("detailBackdrop").classList.remove("show");
  document.getElementById("detailSheet").classList.remove("show");
}

// ─── RENDER RIWAYAT ──────────────────────────────
function filter3HariTerakhir(data) {
  const batas = new Date(); batas.setDate(batas.getDate()-3);
  return data.filter(t => new Date(t.tanggal) >= batas);
}

function filterTanggal() {
  const s = document.getElementById("startDate").value;
  const e = document.getElementById("endDate").value;
  if (!s||!e) return showToast("Pilih tanggal awal dan akhir!","warning");
  const start=new Date(s), end=new Date(e); end.setHours(23,59,59,999);
  renderRiwayat(semuaData.filter(t=>{const d=new Date(t.tanggal);return d>=start&&d<=end;}));
}

function renderRiwayat(data) {
  const c = document.getElementById("riwayatContainer");
  c.innerHTML = "";
  if (!data.length) {
    c.innerHTML = "<p style='text-align:center;padding:24px;color:#6b7280'>Tidak ada transaksi.</p>";
    return;
  }
  data.slice().reverse().forEach((trx, idx) => {
    const jenisRaw   = String(trx.jenis||"").toLowerCase();
    const isTransfer = jenisRaw.startsWith("transfer");
    const badgeClass = isTransfer ? "transfer" : jenisRaw;
    const nomClass   = isTransfer ? "transfer" : jenisRaw;
    const badgeLabel = isTransfer ? "🔄 Transfer" : trx.jenis;
    const cardClass  = isTransfer ? "trx-card transfer-card" : "trx-card";

    c.innerHTML += `
    <div class="${cardClass}" style="animation-delay:${idx*.04}s">
      <div class="trx-header">
        <h6><span class="trx-badge ${badgeClass}">${badgeLabel}</span>${(trx.kategori||"").toUpperCase()}</h6>
        <span class="trx-date">${formatTanggal(trx.tanggal)}</span>
      </div>
      <div class="trx-detail">
        <span class="trx-detail-meta">${trx.kepemilikan||""} • ${trx.dompet||""} (${trx.dompetDetail||""})</span>
        <span class="trx-nominal ${nomClass}">${formatRupiah(trx.nominal)}</span>
      </div>
      <small class="trx-deskripsi">${capitalizeFirst(trx.deskripsi||"-")}</small>
    </div>`;
  });
}

function filterTable() {
  const kw = document.getElementById("filter").value.toLowerCase();
  renderRiwayat(semuaData.filter(t=>(t.kategori+t.dompet+t.jenis+t.deskripsi).toLowerCase().includes(kw)));
}

// ─── EXPORT CSV ──────────────────────────────────
function exportExcel() {
  let filtered = semuaData.slice();
  const kw     = document.getElementById("filter").value.toLowerCase();
  const sDate  = document.getElementById("startDate").value;
  const eDate  = document.getElementById("endDate").value;
  if (kw) filtered = filtered.filter(t=>(t.kategori+t.dompet+t.jenis+t.deskripsi).toLowerCase().includes(kw));
  if (sDate&&eDate) {
    const s=new Date(sDate),e=new Date(eDate);e.setHours(23,59,59,999);
    filtered=filtered.filter(t=>{const d=new Date(t.tanggal);return d>=s&&d<=e;});
  }
  if (!filtered.length) { showToast("Tidak ada data untuk diekspor!","warning"); return; }
  let csv="Jenis,Kategori,Nominal,Deskripsi,Kepemilikan,Dompet,Detail Dompet,Tanggal\n";
  filtered.forEach(t=>{csv+=`${t.jenis},${t.kategori},${t.nominal},"${t.deskripsi}",${t.kepemilikan},${t.dompet},${t.dompetDetail},${formatTanggal(t.tanggal)}\n`;});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  a.download=`nativan_${new Date().toISOString().slice(0,10)}.csv`;a.click();
}

// ─── DOMPET DETAIL OPTIONS ───────────────────────
const detailOptions = {
  Cash:       ["Cash"],
  "M-Banking":["BTN","Mandiri","BRI","BSI"],
  "E-Wallet": ["Gopay","Dana","OVO","ShopeePay","LinkAja"],
};

function updateDetailDompet() {
  const opts = detailOptions[document.getElementById("dompet").value] || [];
  const sel  = document.getElementById("dompetDetail");
  sel.innerHTML = '<option value="">-- Pilih --</option>';
  opts.forEach(o => { const el=document.createElement("option"); el.value=el.textContent=o; sel.appendChild(el); });
}

function updateTransferDetail(arah) {
  const dompetId = arah==="dari" ? "trfDariDompet" : "trfKeDompet";
  const detailId = arah==="dari" ? "trfDariDetail" : "trfKeDetail";
  const opts     = detailOptions[document.getElementById(dompetId).value] || [];
  const sel      = document.getElementById(detailId);
  sel.innerHTML  = '<option value="">-- Pilih --</option>';
  opts.forEach(o => { const el=document.createElement("option"); el.value=el.textContent=o; sel.appendChild(el); });
}

// ─── MODAL ───────────────────────────────────────
function openModal() {
  document.getElementById("debugPanel").classList.remove("show");
  document.getElementById("modalTambah").classList.add("show");
  document.getElementById("modalBackdrop").classList.add("show");
}

function closeModal() {
  document.getElementById("modalTambah").classList.remove("show");
  document.getElementById("modalBackdrop").classList.remove("show");
}

function switchModalTab(tab) {
  const isTrx = tab === "trx";
  document.getElementById("panelTrx").style.display      = isTrx ? "" : "none";
  document.getElementById("panelTransfer").style.display = isTrx ? "none" : "";
  document.getElementById("tabTrx").classList.toggle("active",  isTrx);
  document.getElementById("tabTransfer").classList.toggle("active", !isTrx);
}

// ─── LOGIN ───────────────────────────────────────
function checkPassword() {
  const v = document.getElementById("passwordInput").value;
  if (v === APP_PASSWORD) {
    localStorage.setItem("login_nativan", JSON.stringify({status:true, time:Date.now()}));
    document.getElementById("loginScreen").style.display = "none";
    loadData(true);
    setTimeout(requestNotifPermission, 3500);
  } else {
    const el = document.getElementById("loginError");
    el.textContent = "❌ Password salah, coba lagi";
    el.style.animation = "none"; el.offsetWidth;
    el.style.animation = "bounceIn .3s ease";
  }
}

// ─── PUSH NOTIFICATION ───────────────────────────
async function requestNotifPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") { updateNotifBanner(false); return; }
  if (Notification.permission === "denied")  { updateNotifBanner(true,"denied"); return; }
  updateNotifBanner(true, "ask");
}

function updateNotifBanner(show, state="ask") {
  const banner = document.getElementById("notifBanner");
  if (!banner) return;
  if (!show) { banner.style.display="none"; return; }
  if (state==="denied") {
    banner.innerHTML=`<div class="notif-banner-icon">🔕</div><div class="notif-banner-text"><strong>Notifikasi diblokir</strong><span>Aktifkan di pengaturan browser</span></div>`;
    banner.style.cursor="default";
  } else {
    banner.style.display="flex";
  }
}

async function askNotifPermission() {
  if (!("Notification" in window)) return;
  const perm = await Notification.requestPermission();
  if (perm==="granted") {
    updateNotifBanner(false);
    showToast("🔔 Notifikasi diaktifkan!", 3000, "success");
    _subscribePush();
  } else {
    updateNotifBanner(true,"denied");
  }
}

function sendLocalNotif(title, body, icon="assets/icons/icon-192.png") {
  if (!("Notification" in window) || Notification.permission!=="granted") return;
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body, icon, badge:icon, vibrate:[200,100,200],
        tag:"nativan-"+Date.now(), data:{url:window.location.href}
      });
    });
  } else {
    new Notification(title, {body, icon});
  }
}

function notifBudget(pct, sisa, actualPct) {
  const emoji = pct>=100 ? "🚨" : pct>=90 ? "⚠️" : "⚡";
  const title = `${emoji} Budget ${pct>=100?"HABIS!":pct+"% terpakai"}`;
  const body  = pct>=100 ? "Budget periode ini sudah habis!" : `Sisa: ${formatRupiah(sisa)} (${Math.round(actualPct)}% terpakai)`;
  sendLocalNotif(title, body);
  showToast(`${title} — ${body}`, 6000, pct>=100?"error":"warning");
}

// Subscribe web push (tersembunyi, tanpa tampilkan URL/key di UI)
async function _subscribePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (await reg.pushManager.getSubscription()) return;
    const padding = '='.repeat((4-VAPID_KEY.length%4)%4);
    const b64     = (VAPID_KEY+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw     = window.atob(b64);
    const key     = Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
    await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:key });
  } catch(e) {
    console.warn("[Push]", e.message);
  }
}

// ─── INIT ─────────────────────────────────────────
window.addEventListener("load", () => {
  // Cek sesi login (1 jam)
  const raw = localStorage.getItem("login_nativan");
  if (raw) {
    try {
      const sess = JSON.parse(raw);
      if (Date.now() - sess.time < 3600000) {
        document.getElementById("loginScreen").style.display = "none";
        loadData(true);
        setTimeout(requestNotifPermission, 3500);
      } else {
        localStorage.removeItem("login_nativan");
      }
    } catch(_) { localStorage.removeItem("login_nativan"); }
  }

  localStorage.setItem("login_time", Date.now());

  // Register SW
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js")
      .then(r=>console.log("[SW]",r.scope))
      .catch(e=>console.warn("[SW]",e));
  }

  // Form listeners
  document.getElementById("dompet").addEventListener("change", updateDetailDompet);
  updateDetailDompet();
  updateTransferDetail("dari");
  updateTransferDetail("ke");

  // Format nominal otomatis
  ["nominal","trfNominal","budgetInput"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", e => {
      e.target.value = e.target.value.replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,".");
    });
  });

  document.getElementById("passwordInput").addEventListener("keydown", e => {
    if (e.key==="Enter") checkPassword();
  });

  if ("Notification" in window && Notification.permission==="granted") updateNotifBanner(false);
});
