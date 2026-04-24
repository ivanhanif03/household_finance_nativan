/* =====================================================
   KEUANGAN NATIVAN — app.js v5
   - OneSignal background push notification
   - localStorage cache (instant load)
   - Toast UI premium
===================================================== */

// ─── CONFIG ──────────────────────────────────────────
const SCRIPT_URL      = "https://script.google.com/macros/s/AKfycbx85BqK5LKIzJd9xoxiMkoViIsxBZqYaCJ7cKHhIprcDx6TWVXzyiznYQCvExSjzhRJ/exec";
const APP_PASSWORD    = "nativan300424";
const ONESIGNAL_APPID = "6f25ad6c-97c1-444a-9869-951998adc9e2"; // ← isi setelah daftar onesignal.com

// ─── CACHE CONFIG ────────────────────────────────────
const CACHE_KEY = "nativan_v5_cache";
const CACHE_TTL = 3 * 60 * 1000; // 3 menit — setelah itu refresh otomatis

// ─── STATE ───────────────────────────────────────────
let semuaData     = [];
let semuaBudget   = [];
let lastBudgetPct = 0;
let _bgRefreshing = false;

// ─── GAS API ─────────────────────────────────────────
async function gasCall(params) {
  const url = SCRIPT_URL + "?" + new URLSearchParams({ ...params, _t: Date.now() });
  const res = await fetch(url, { method:"GET", cache:"no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (_) { throw new Error("Resp bukan JSON: " + text.slice(0,80)); }
}

// ─── CACHE HELPERS ───────────────────────────────────
function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch(_) {}
}

function getCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null; // expired
    return data;
  } catch(_) { return null; }
}

function applyData(data) {
  semuaData   = data.transaksi || [];
  semuaBudget = data.budget    || [];
  handleBudgetUI();
  renderDashboard();
  renderRiwayat(filter3HariTerakhir(semuaData));
}

// ─── LOAD DATA (cache-first, then background refresh) ─
async function loadData(withSplash = false) {
  const cached = getCache();

  if (cached) {
    // ✅ Ada cache → tampil INSTAN, refresh di background
    if (withSplash) {
      showSplash();
      setSplash(60, "Memuat data tersimpan...");
      await wait(80);
      applyData(cached);
      setSplash(100, "Siap! ✨");
      await wait(300);
      hideSplash();
    } else {
      applyData(cached);
    }
    // Background refresh tanpa loading indicator
    _bgRefresh();
    return;
  }

  // ❌ Tidak ada cache → fetch penuh dengan splash
  if (withSplash) {
    showSplash();
    await wait(200);
    setSplash(25, "Menghubungkan ke server...");
  } else {
    showLoading(true);
  }

  try {
    const data = await gasCall({ action:"getData" });
    if (data.status === "ERROR") {
      showToast("GAS Error: " + data.message, "error");
      withSplash ? hideSplash() : showLoading(false);
      return;
    }
    saveCache(data);
    if (withSplash) { setSplash(85, "Menyiapkan tampilan..."); await wait(100); }
    applyData(data);
    if (withSplash) { setSplash(100, "Siap! ✨"); await wait(400); hideSplash(); }
  } catch(err) {
    console.error("[loadData]", err);
    showToast("Gagal memuat data. Cek koneksi internet.", "error");
    withSplash ? hideSplash() : null;
  }
  if (!withSplash) showLoading(false);
}

// Background refresh — update cache & UI tanpa ganggu user
async function _bgRefresh() {
  if (_bgRefreshing) return;
  _bgRefreshing = true;
  try {
    const data = await gasCall({ action:"getData" });
    if (data.status === "OK") {
      saveCache(data);
      applyData(data);
    }
  } catch(_) { /* silent */ }
  _bgRefreshing = false;
}

// Force refresh (dipakai setelah simpan transaksi)
async function refreshData() {
  showLoading(true);
  try {
    const data = await gasCall({ action:"getData" });
    if (data.status === "OK") { saveCache(data); applyData(data); }
  } catch(err) {
    showToast("Gagal refresh data", "error");
  }
  showLoading(false);
}

// ─── HELPERS ─────────────────────────────────────────
const wait        = ms => new Promise(r => setTimeout(r, ms));
const showLoading = v  => { document.getElementById("loadingOverlay").style.display = v?"flex":"none"; };

const formatRupiah = n =>
  "Rp " + Math.abs(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const formatTanggal = t => {
  const d = new Date(t); if (isNaN(d)) return "-";
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

const capitalizeFirst = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

// ─── TOAST SYSTEM (premium) ──────────────────────────
const TOAST_ICONS = { success:"✅", error:"❌", warning:"⚡", info:"ℹ️" };
const TOAST_TYPES = { success:"t-success", error:"t-error", warning:"t-warning", info:"t-info" };
let _toastCount = 0;

function showToast(msg, type = "info", duration = 4000, sub = "") {
  const wrap = document.getElementById("toastContainer");
  const id   = "toast_" + (++_toastCount);
  const icon = TOAST_ICONS[type] || "ℹ️";
  const cls  = TOAST_TYPES[type]  || "t-info";

  const el = document.createElement("div");
  el.id        = id;
  el.className = `toast ${cls}`;
  el.style.setProperty("--toast-dur", duration + "ms");
  el.innerHTML = `
    <div class="toast-inner">
      <div class="toast-icon-box">${icon}</div>
      <div class="toast-body">
        <div class="toast-title">${msg}</div>
        ${sub ? `<div class="toast-sub" style="display:block">${sub}</div>` : ""}
      </div>
      <button class="toast-close" onclick="dismissToast('${id}')">✕</button>
    </div>`;
  wrap.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
  el._timer = setTimeout(() => dismissToast(id), duration);
}

function dismissToast(id) {
  const el = document.getElementById(id);
  if (!el) return;
  clearTimeout(el._timer);
  el.classList.remove("show");
  el.classList.add("hiding");
  setTimeout(() => el.remove(), 300);
}

// ─── SUCCESS NOTIFICATION (transaksi berhasil) ────────
let _snTimer = null;
function showSuccessNotif(icon, label, detail, nominal, dur = 4000) {
  let el = document.getElementById("successNotif");
  if (!el) {
    el = document.createElement("div");
    el.id = "successNotif";
    el.className = "success-notif";
    el.innerHTML = `
      <div class="sn-left">
        <div class="sn-icon-ring" id="snIconRing">
          <span id="snIcon"></span>
        </div>
      </div>
      <div class="sn-body">
        <div class="sn-label"  id="snLabel"></div>
        <div class="sn-detail" id="snDetail"></div>
        <div class="sn-amount" id="snAmount"></div>
      </div>
      <button class="sn-close" onclick="dismissSuccessNotif()">✕</button>
      <div class="sn-progress-track">
        <div class="sn-progress-fill" id="snFill"></div>
      </div>`;
    document.body.appendChild(el);
  }

  const fill = document.getElementById("snFill");
  fill.style.animation = "none"; fill.offsetWidth;
  fill.style.animationDuration = dur + "ms";
  fill.style.animation = `snDrain ${dur}ms linear forwards`;

  document.getElementById("snIcon").textContent   = icon;
  document.getElementById("snLabel").textContent  = label;
  document.getElementById("snDetail").textContent = detail;
  document.getElementById("snAmount").textContent = formatRupiah(nominal);

  el.classList.remove("sn-hide");
  el.classList.add("sn-show");

  if (_snTimer) clearTimeout(_snTimer);
  _snTimer = setTimeout(() => dismissSuccessNotif(), dur);
}

function dismissSuccessNotif() {
  const el = document.getElementById("successNotif");
  if (!el) return;
  el.classList.remove("sn-show");
  el.classList.add("sn-hide");
}

// ─── OVERLAY TOAST (legacy, dipakai splash) ──────────
let _obBusy = false;
function showOverlayToast(msg = "✅ Berhasil!", dur = 1800) {
  if (_obBusy) return; _obBusy = true;
  const el = document.getElementById("overlayToast");
  el.textContent = msg; el.classList.remove("show"); el.offsetWidth; el.classList.add("show");
  setTimeout(() => { el.classList.remove("show"); _obBusy = false; }, dur);
}

// ─── CUSTOM ALERT ─────────────────────────────────────
function showAlert({ icon="ℹ️", title="", message="", buttons=[] }) {
  document.getElementById("alertIconWrap").textContent = icon;
  document.getElementById("alertTitle").textContent    = title;
  document.getElementById("alertMessage").textContent  = message;
  const actionsEl = document.getElementById("alertActions");
  actionsEl.innerHTML = "";
  (buttons.length ? buttons : [{label:"OK", type:"primary"}]).forEach(btn => {
    const b = document.createElement("button");
    b.className = `alert-btn ${btn.type||"primary"}`;
    b.textContent = btn.label;
    b.onclick = () => { closeAlert(); if (btn.onClick) btn.onClick(); };
    actionsEl.appendChild(b);
  });
  document.getElementById("alertBackdrop").classList.add("show");
  document.getElementById("alertModal").classList.add("show");
}
function closeAlert() {
  document.getElementById("alertBackdrop").classList.remove("show");
  document.getElementById("alertModal").classList.remove("show");
}

// ─── SPLASH ──────────────────────────────────────────
function showSplash() {
  const bar = document.getElementById("splashBar");
  bar.style.transition = "none"; bar.style.width = "0%";
  document.getElementById("splashPct").textContent    = "0%";
  document.getElementById("splashStatus").textContent = "Memuat data...";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bar.style.transition = "width .4s cubic-bezier(.4,0,.2,1)";
    document.getElementById("splashScreen").classList.add("active");
  }));
}
function hideSplash() { document.getElementById("splashScreen").classList.remove("active"); }
function setSplash(pct, status) {
  requestAnimationFrame(() => {
    document.getElementById("splashBar").style.width = pct + "%";
    document.getElementById("splashPct").textContent = Math.round(pct) + "%";
    if (status) document.getElementById("splashStatus").textContent = status;
  });
}

// ─── SIMPAN TRANSAKSI ─────────────────────────────────
async function simpanTransaksi() {
  const kategori = document.getElementById("kategori").value.trim();
  const nominal  = document.getElementById("nominal").value.replace(/\./g,"");
  if (!kategori) { showAlert({ icon:"⚠️", title:"Kategori Kosong", message:"Masukkan kategori transaksi.", buttons:[{label:"OK"}] }); return; }
  if (!nominal)  { showAlert({ icon:"⚠️", title:"Nominal Kosong",  message:"Masukkan nominal transaksi.", buttons:[{label:"OK"}] }); return; }

  const btn   = document.getElementById("btnSimpan");
  const jenis = document.getElementById("jenis").value;
  btn.disabled = true;
  showLoading(true);

  try {
    const result = await gasCall({
      action:"addTransaksi", jenis, kategori, nominal,
      deskripsi:    document.getElementById("deskripsi").value.trim(),
      dompet:       document.getElementById("dompet").value,
      dompetDetail: document.getElementById("dompetDetail").value,
      kepemilikan:  document.getElementById("kepemilikan").value,
    });
    showLoading(false);
    if (result.status === "OK") {
      closeModal();
      document.getElementById("kategori").value  = "";
      document.getElementById("nominal").value   = "";
      document.getElementById("deskripsi").value = "";
      showSuccessNotif(
        jenis==="Pendapatan" ? "💰" : "💸",
        jenis==="Pendapatan" ? "Pendapatan Tercatat ✓" : "Pengeluaran Tercatat ✓",
        kategori, nominal
      );
      // Invalidate cache agar refresh dapat data terbaru
      localStorage.removeItem(CACHE_KEY);
      await wait(600);
      refreshData();
    } else {
      showAlert({ icon:"❌", title:"Gagal Menyimpan", message: result.message||"Terjadi kesalahan.", buttons:[{label:"Tutup",type:"danger"}] });
    }
  } catch(err) {
    showLoading(false);
    showAlert({ icon:"📡", title:"Koneksi Bermasalah", message:err.message, buttons:[{label:"Tutup",type:"danger"}] });
  } finally { btn.disabled = false; }
}

// ─── PINDAH DANA ──────────────────────────────────────
async function simpanTransfer() {
  const nominal         = document.getElementById("trfNominal").value.replace(/\./g,"");
  const dariKepemilikan = document.getElementById("trfDariKepemilikan").value;
  const dariDompet      = document.getElementById("trfDariDompet").value;
  const dariDetail      = document.getElementById("trfDariDetail").value;
  const keKepemilikan   = document.getElementById("trfKeKepemilikan").value;
  const keDompet        = document.getElementById("trfKeDompet").value;
  const keDetail        = document.getElementById("trfKeDetail").value;
  const catatan         = document.getElementById("trfCatatan").value.trim();

  if (!nominal)    { showAlert({ icon:"⚠️", title:"Nominal Kosong", message:"Masukkan nominal.", buttons:[{label:"OK"}] }); return; }
  if (!dariDetail) { showAlert({ icon:"⚠️", title:"Pilih Asal",    message:"Pilih detail dompet asal.", buttons:[{label:"OK"}] }); return; }
  if (!keDetail)   { showAlert({ icon:"⚠️", title:"Pilih Tujuan",  message:"Pilih detail dompet tujuan.", buttons:[{label:"OK"}] }); return; }
  if (dariDompet===keDompet && dariDetail===keDetail && dariKepemilikan===keKepemilikan) {
    showAlert({ icon:"⚠️", title:"Sama Persis", message:"Dompet asal dan tujuan tidak boleh sama.", buttons:[{label:"OK"}] }); return;
  }

  const btn = document.getElementById("btnTransfer");
  btn.disabled = true;
  showLoading(true);

  try {
    const result = await gasCall({ action:"addTransfer", nominal, dariKepemilikan, dariDompet, dariDetail, keKepemilikan, keDompet, keDetail, catatan });
    showLoading(false);
    if (result.status === "OK") {
      closeModal();
      document.getElementById("trfNominal").value = "";
      document.getElementById("trfCatatan").value = "";
      showSuccessNotif("🔄", "Pindah Dana Berhasil ✓", `${dariKepemilikan} → ${keKepemilikan}`, nominal);
      localStorage.removeItem(CACHE_KEY);
      await wait(600);
      refreshData();
    } else {
      showAlert({ icon:"❌", title:"Transfer Gagal", message:result.message||"Terjadi kesalahan.", buttons:[{label:"Tutup",type:"danger"}] });
    }
  } catch(err) {
    showLoading(false);
    showAlert({ icon:"📡", title:"Koneksi Bermasalah", message:err.message, buttons:[{label:"Tutup",type:"danger"}] });
  } finally { btn.disabled = false; }
}

// ─── SET BUDGET ───────────────────────────────────────
async function setBudget() {
  const val = document.getElementById("budgetInput").value.replace(/\./g,"");
  if (!val) { showAlert({ icon:"⚠️", title:"Nominal Kosong", message:"Masukkan nominal budget terlebih dahulu.", buttons:[{label:"OK"}] }); return; }

  const periode = getPeriodeBudget();
  const key     = getPeriodeKey(periode.start);
  const btn     = document.getElementById("btnBudget");
  btn.disabled  = true;
  showLoading(true);

  try {
    const result = await gasCall({
      action:"setBudget", periodeKey:key, periodeLabel:periode.label,
      bulan:periode.start.getMonth()+1, tahun:periode.start.getFullYear(), budget:val,
    });
    showLoading(false);
    if (result.status === "OK") {
      showSuccessNotif("📊", "Budget Tersimpan ✓", periode.label, val);
      localStorage.removeItem(CACHE_KEY);
      await wait(600);
      refreshData();
    } else {
      showAlert({ icon:"❌", title:"Gagal Menyimpan Budget", message:result.message||"Terjadi kesalahan.", buttons:[{label:"Tutup",type:"danger"}] });
    }
  } catch(err) {
    showLoading(false);
    showAlert({ icon:"📡", title:"Koneksi Bermasalah", message:err.message, buttons:[{label:"Tutup",type:"danger"}] });
  } finally { btn.disabled = false; }
}

// ─── PERIODE BUDGET (25–24) ───────────────────────────
function getPeriodeBudget(now = new Date()) {
  const d = now.getDate();
  const periodeStart = d >= 25
    ? new Date(now.getFullYear(), now.getMonth(), 25)
    : new Date(now.getFullYear(), now.getMonth()-1, 25);
  const periodeEnd = new Date(periodeStart.getFullYear(), periodeStart.getMonth()+1, 24, 23, 59, 59, 999);
  const bn = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const label = `25 ${bn[periodeStart.getMonth()]} – 24 ${bn[periodeEnd.getMonth()]} ${periodeEnd.getFullYear()}`;
  return { start:periodeStart, end:periodeEnd, label };
}
function getPeriodeKey(s) {
  return `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,"0")}-25`;
}

// ─── RENDER DASHBOARD ────────────────────────────────
function renderDashboard() {
  let pendapatan=0, pengeluaran=0, cash=0, bank=0, wallet=0;
  semuaData.forEach(trx => {
    const n = Number(String(trx.nominal).replace(/\./g,"")) || 0;
    const j = String(trx.jenis||"").trim().toLowerCase();
    if (j==="pendapatan")      { pendapatan+=n; if(trx.dompet==="Cash")cash+=n; else if(trx.dompet==="M-Banking")bank+=n; else wallet+=n; }
    else if (j==="pengeluaran"){ pengeluaran+=n; if(trx.dompet==="Cash")cash-=n; else if(trx.dompet==="M-Banking")bank-=n; else wallet-=n; }
    else if (j==="transfer-keluar"){ if(trx.dompet==="Cash")cash-=n; else if(trx.dompet==="M-Banking")bank-=n; else wallet-=n; }
    else if (j==="transfer-masuk") { if(trx.dompet==="Cash")cash+=n; else if(trx.dompet==="M-Banking")bank+=n; else wallet+=n; }
  });
  document.getElementById("totalPendapatan").textContent  = formatRupiah(pendapatan);
  document.getElementById("totalPengeluaran").textContent = formatRupiah(pengeluaran);
  document.getElementById("saldo").textContent            = formatRupiah(pendapatan-pengeluaran);
  document.getElementById("saldoCash").textContent        = formatRupiah(cash);
  document.getElementById("saldoBank").textContent        = formatRupiah(bank);
  document.getElementById("saldoWallet").textContent      = formatRupiah(wallet);
  updateBudget();
}

function handleBudgetUI() {
  const periode = getPeriodeBudget();
  const key     = getPeriodeKey(periode.start);
  const cur     = semuaBudget.find(b => b.periodeKey === key);
  const pEl     = document.getElementById("budgetPeriod");
  if (pEl) pEl.textContent = "📅 " + periode.label;
  const inp = document.getElementById("budgetInput");
  const btn = document.getElementById("btnBudget");
  if (cur && cur.budget) { inp.value = cur.budget.toString().replace(/\B(?=(\d{3})+(?!\d))/g,"."); btn.textContent="Edit"; }
  else { inp.value=""; btn.textContent="Set"; }
}

function updateBudget() {
  const periode = getPeriodeBudget();
  const key     = getPeriodeKey(periode.start);
  const cur     = semuaBudget.find(b => b.periodeKey === key);
  let realisasi = 0;
  semuaData.forEach(t => {
    const tgl = new Date(t.tanggal);
    if (tgl>=periode.start && tgl<=periode.end && String(t.jenis).toLowerCase()==="pengeluaran")
      realisasi += Number(String(t.nominal).replace(/\./g,"")) || 0;
  });
  if (!cur || !cur.budget) {
    document.getElementById("budgetSisa").textContent  = "Belum ada budget periode ini";
    document.getElementById("budgetBar").style.width   = "0%";
    document.getElementById("budgetWarning").innerHTML = "";
    return;
  }
  const persen = (realisasi/cur.budget)*100;
  const sisa   = cur.budget - realisasi;
  document.getElementById("budgetSisa").textContent = "Sisa: " + formatRupiah(sisa);
  const bar  = document.getElementById("budgetBar");
  bar.style.width = Math.min(persen,100) + "%";
  const warn = document.getElementById("budgetWarning");
  const prev = lastBudgetPct; lastBudgetPct = persen;
  if (persen>=100) { bar.style.background="#ef4444"; warn.innerHTML="🚨 Budget HABIS!"; warn.className="budget-warning warning100"; if(prev<100) _notifBudget(100,sisa,persen); }
  else if (persen>=90) { bar.style.background="#fb923c"; warn.innerHTML="⚠️ Budget hampir habis (90%)"; warn.className="budget-warning warning90"; if(prev<90) _notifBudget(90,sisa,persen); }
  else if (persen>=80) { bar.style.background="#fde047"; warn.innerHTML="⚡ Budget sudah 80%"; warn.className="budget-warning warning80"; if(prev<80) _notifBudget(80,sisa,persen); }
  else { bar.style.background="#4ade80"; warn.innerHTML="Budget periode ini aman ✓"; warn.className="budget-warning"; }
}

function _notifBudget(pct, sisa, ap) {
  const emoji = pct>=100?"🚨":pct>=90?"⚠️":"⚡";
  const t = `${emoji} Budget ${pct>=100?"HABIS!":pct+"% terpakai"}`;
  const b = pct>=100?"Budget periode ini sudah habis!":`Sisa: ${formatRupiah(sisa)} (${Math.round(ap)}%)`;
  _sendLocalNotif(t, b);
  showToast(`${t} — ${b}`, pct>=100?"error":"warning", 7000);
}

// ─── DETAIL SALDO BOTTOM SHEET ───────────────────────
const avatarMap   = { Ayah:"👨", Ibun:"👩", Izora:"👧" };
const avatarBg    = { Ayah:"#dbeafe", Ibun:"#fce7f3", Izora:"#fef9c3" };
const avatarColor = { Ayah:"#1e40af", Ibun:"#9d174d", Izora:"#713f12" };

function toggleDetail(tipe) {
  const ikon  = { Cash:"💵","M-Banking":"🏦","E-Wallet":"📱" }[tipe]||"💰";
  document.getElementById("detailSheetTitle").textContent = `${ikon} Detail ${tipe}`;
  const body = document.getElementById("detailSheetBody");
  body.innerHTML = "";
  const df = semuaData.filter(t => t.dompet===tipe);
  if (!df.length) {
    body.innerHTML=`<div style="text-align:center;padding:40px;color:#9ca3af"><div style="font-size:2.5rem;margin-bottom:8px">🪹</div><p>Belum ada transaksi di ${tipe}</p></div>`;
  } else {
    const byDetail = {};
    df.forEach(t => {
      const det=t.dompetDetail||"Tidak Ada"; const prs=t.kepemilikan||"Umum";
      if(!byDetail[det]) byDetail[det]={};
      if(!byDetail[det][prs]) byDetail[det][prs]=0;
      const n=Number(String(t.nominal).replace(/\./g,""))||0;
      const j=String(t.jenis||"").toLowerCase();
      byDetail[det][prs]+=(j==="pendapatan"||j==="transfer-masuk")?n:-n;
    });
    Object.entries(byDetail).forEach(([det,persons])=>{
      const total=Object.values(persons).reduce((a,b)=>a+b,0);
      const g=document.createElement("div"); g.className="detail-wallet-group";
      g.innerHTML=`<div class="detail-wallet-label">${det}</div>`;
      Object.entries(persons).forEach(([prs,val])=>{
        const row=document.createElement("div"); row.className="detail-person-row";
        row.innerHTML=`<div class="detail-person-info"><div class="detail-person-avatar" style="background:${avatarBg[prs]||"#f3f4f6"};color:${avatarColor[prs]||"#374151"}">${avatarMap[prs]||"👤"}</div><div><div class="detail-person-name">${prs}</div><div class="detail-person-sub">${det}</div></div></div><div class="detail-person-amount ${val>=0?"positive":"negative"}">${val<0?"- ":""}${formatRupiah(Math.abs(val))}</div>`;
        g.appendChild(row);
      });
      const tr=document.createElement("div"); tr.className="detail-total-row";
      tr.innerHTML=`<span class="detail-total-label">Total ${det}</span><span class="detail-total-amount">${formatRupiah(total)}</span>`;
      g.appendChild(tr); body.appendChild(g);
    });
  }
  document.getElementById("detailBackdrop").classList.add("show");
  document.getElementById("detailSheet").classList.add("show");
}
function closeDetail() {
  document.getElementById("detailBackdrop").classList.remove("show");
  document.getElementById("detailSheet").classList.remove("show");
}

// ─── RIWAYAT ─────────────────────────────────────────
function filter3HariTerakhir(data) {
  const batas=new Date(); batas.setDate(batas.getDate()-3);
  return data.filter(t=>new Date(t.tanggal)>=batas);
}
function filterTanggal() {
  const s=document.getElementById("startDate").value, e=document.getElementById("endDate").value;
  if(!s||!e){showToast("Pilih tanggal awal dan akhir","warning");return;}
  const start=new Date(s),end=new Date(e); end.setHours(23,59,59,999);
  renderRiwayat(semuaData.filter(t=>{const d=new Date(t.tanggal);return d>=start&&d<=end;}));
}
function filterTable() {
  const kw=document.getElementById("filter").value.toLowerCase();
  renderRiwayat(semuaData.filter(t=>(t.kategori+t.dompet+t.jenis+t.deskripsi).toLowerCase().includes(kw)));
}
function renderRiwayat(data) {
  const c=document.getElementById("riwayatContainer"); c.innerHTML="";
  if(!data.length){c.innerHTML="<p style='text-align:center;padding:24px;color:#6b7280'>Tidak ada transaksi.</p>";return;}
  data.slice().reverse().forEach((trx,idx)=>{
    const jr=String(trx.jenis||"").toLowerCase();
    const isT=jr.startsWith("transfer");
    const bc=isT?"transfer":jr, nl=isT?"transfer":jr;
    const bl=isT?"🔄 Transfer":trx.jenis;
    c.innerHTML+=`<div class="${isT?"trx-card transfer-card":"trx-card"}" style="animation-delay:${idx*.03}s">
      <div class="trx-header">
        <h6><span class="trx-badge ${bc}">${bl}</span>${(trx.kategori||"").toUpperCase()}</h6>
        <span class="trx-date">${formatTanggal(trx.tanggal)}</span>
      </div>
      <div class="trx-detail">
        <span class="trx-detail-meta">${trx.kepemilikan||""} • ${trx.dompet||""} (${trx.dompetDetail||""})</span>
        <span class="trx-nominal ${nl}">${formatRupiah(trx.nominal)}</span>
      </div>
      <small class="trx-deskripsi">${capitalizeFirst(trx.deskripsi||"-")}</small>
    </div>`;
  });
}

// ─── EXPORT ──────────────────────────────────────────
function exportExcel() {
  let f=semuaData.slice();
  const kw=document.getElementById("filter").value.toLowerCase();
  const sd=document.getElementById("startDate").value, ed=document.getElementById("endDate").value;
  if(kw) f=f.filter(t=>(t.kategori+t.dompet+t.jenis+t.deskripsi).toLowerCase().includes(kw));
  if(sd&&ed){const s=new Date(sd),e=new Date(ed);e.setHours(23,59,59,999);f=f.filter(t=>{const d=new Date(t.tanggal);return d>=s&&d<=e;});}
  if(!f.length){showToast("Tidak ada data untuk diekspor","warning");return;}
  let csv="Jenis,Kategori,Nominal,Deskripsi,Kepemilikan,Dompet,Detail,Tanggal\n";
  f.forEach(t=>{csv+=`${t.jenis},${t.kategori},${t.nominal},"${t.deskripsi}",${t.kepemilikan},${t.dompet},${t.dompetDetail},${formatTanggal(t.tanggal)}\n`;});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
  a.download=`nativan_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

// ─── DOMPET DETAIL ────────────────────────────────────
const detailOptions={ Cash:["Cash"],"M-Banking":["BTN","Mandiri","BRI","BSI"],"E-Wallet":["Gopay","Dana","OVO","ShopeePay","LinkAja"] };
function updateDetailDompet() {
  const opts=detailOptions[document.getElementById("dompet").value]||[];
  const sel=document.getElementById("dompetDetail");
  sel.innerHTML='<option value="">-- Pilih --</option>';
  opts.forEach(o=>{const e=document.createElement("option");e.value=e.textContent=o;sel.appendChild(e);});
}
function updateTransferDetail(arah) {
  const did=arah==="dari"?"trfDariDompet":"trfKeDompet";
  const sid=arah==="dari"?"trfDariDetail":"trfKeDetail";
  const opts=detailOptions[document.getElementById(did).value]||[];
  const sel=document.getElementById(sid);
  sel.innerHTML='<option value="">-- Pilih --</option>';
  opts.forEach(o=>{const e=document.createElement("option");e.value=e.textContent=o;sel.appendChild(e);});
}

// ─── MODAL ────────────────────────────────────────────
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
  const isTrx=tab==="trx";
  document.getElementById("panelTrx").style.display      = isTrx?"":"none";
  document.getElementById("panelTransfer").style.display = isTrx?"none":"";
  document.getElementById("tabTrx").classList.toggle("active", isTrx);
  document.getElementById("tabTransfer").classList.toggle("active", !isTrx);
}

// ─── LOGIN ────────────────────────────────────────────
function checkPassword() {
  const v=document.getElementById("passwordInput").value;
  if (v===APP_PASSWORD) {
    localStorage.setItem("login_nativan", JSON.stringify({status:true, time:Date.now()}));
    document.getElementById("loginScreen").style.display="none";
    loadData(true);
    // Tunda sedikit agar splash tidak tabrakan dengan banner
    setTimeout(_checkNotifState, 2500);
  } else {
    const el=document.getElementById("loginError");
    el.textContent="❌ Password salah, coba lagi";
    el.style.animation="none"; el.offsetWidth; el.style.animation="bounceIn .3s ease";
  }
}

// ─── PUSH NOTIFICATION SYSTEM ────────────────────────
// Mode 1: OneSignal (background push, saat app tertutup)
// Mode 2: Native Web Notification API (fallback, saat app terbuka)
// Keduanya jalan bersamaan jika OneSignal dikonfigurasi

const _hasOneSignal = () =>
  ONESIGNAL_APPID !== "GANTI_DENGAN_APP_ID_ONESIGNAL_KAMU" &&
  ONESIGNAL_APPID !== "" && ONESIGNAL_APPID.length > 10;

// Init OneSignal (hanya jika App ID sudah diisi)
function _initOneSignal() {
  if (!_hasOneSignal()) return;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APPID,
        notifyButton: { enable: false },
        promptOptions: {
          slidedown: { prompts: [{ type:"push", autoPrompt:false }] }
        }
      });
      const perm = await OneSignal.Notifications.permission;
      if (perm) updateNotifBanner(false);
    } catch(e) {
      console.warn("[OneSignal init]", e);
    }
  });
}

// Cek & tampilkan banner notifikasi
// Dipanggil setelah login — selalu cek state permission
function _checkNotifState() {
  if (!("Notification" in window)) {
    updateNotifBanner(false); // browser tidak support, sembunyikan
    return;
  }

  if (Notification.permission === "granted") {
    updateNotifBanner(false); // sudah izin, sembunyikan banner
    return;
  }

  if (Notification.permission === "denied") {
    // Diblokir — tampilkan banner info cara buka di settings
    updateNotifBanner(true, "denied");
    return;
  }

  // "default" — belum diminta, tampilkan banner ajakan
  updateNotifBanner(true, "ask");
}

// Minta izin — coba OneSignal dulu, fallback ke native
async function askNotifPermission() {
  if (_hasOneSignal()) {
    // Pakai OneSignal prompt
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    OneSignalDeferred.push(async function(OneSignal) {
      try {
        await OneSignal.Slidedown.promptPush();
        const perm = await OneSignal.Notifications.permission;
        if (perm) {
          updateNotifBanner(false);
          showToast("Notifikasi diaktifkan! Kamu akan dapat notif bahkan saat app tertutup 🔔", "success", 4000);
        }
      } catch(e) {
        // Fallback ke native jika OneSignal gagal
        _askNativePermission();
      }
    });
  } else {
    // Tidak pakai OneSignal → langsung minta native permission
    _askNativePermission();
  }
}

async function _askNativePermission() {
  if (!("Notification" in window)) return;
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    updateNotifBanner(false);
    showToast("Notifikasi diaktifkan! 🔔 Kamu akan dapat notif saat ada transaksi baru.", "success", 4000);
  } else if (perm === "denied") {
    updateNotifBanner(true, "denied");
    showToast("Notifikasi diblokir. Aktifkan manual di pengaturan browser.", "warning", 5000);
  }
}

// Update tampilan banner notifikasi
function updateNotifBanner(show, state = "ask") {
  const banner = document.getElementById("notifBanner");
  if (!banner) return;

  if (!show) {
    banner.style.display = "none";
    return;
  }

  if (state === "denied") {
    banner.style.display = "flex";
    banner.style.background = "linear-gradient(135deg, #6b7280, #4b5563)";
    banner.querySelector(".notif-banner-text strong").textContent = "Notifikasi Diblokir";
    banner.querySelector(".notif-banner-text span").textContent   = "Aktifkan di pengaturan browser untuk terima notif";
    banner.querySelector("button").style.display = "none";
  } else {
    banner.style.display = "flex";
    banner.style.background = "";
    banner.querySelector(".notif-banner-text strong").textContent = "Aktifkan Notifikasi";
    banner.querySelector(".notif-banner-text span").textContent =
      _hasOneSignal()
        ? "Terima notif transaksi bahkan saat app tertutup 🔔"
        : "Terima notif transaksi saat app terbuka 🔔";
    const btn = banner.querySelector("button");
    btn.style.display = "";
    btn.textContent   = "Izinkan";
  }
}

// Kirim notifikasi lokal (saat app terbuka / foreground)
function _sendLocalNotif(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const options = {
    body,
    icon:    "assets/icons/icon-192.png",
    badge:   "assets/icons/icon-192.png",
    vibrate: [200, 100, 200],
    tag:     "nativan-" + Date.now(),
    data:    { url: window.location.href }
  };

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options));
  } else {
    new Notification(title, options);
  }
}


// ─── INIT ─────────────────────────────────────────────
window.addEventListener("load", () => {
  // Cek sesi (1 jam)
  const raw = localStorage.getItem("login_nativan");
  if (raw) {
    try {
      const sess=JSON.parse(raw);
      if (Date.now()-sess.time < 3600000) {
        document.getElementById("loginScreen").style.display="none";
        loadData(true);
        setTimeout(_checkNotifState, 2500);
      } else { localStorage.removeItem("login_nativan"); }
    } catch(_) { localStorage.removeItem("login_nativan"); }
  }
  localStorage.setItem("login_time", Date.now());

  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(e=>console.warn("[SW]",e));
  }

  // OneSignal
  _initOneSignal();

  // Form listeners
  document.getElementById("dompet").addEventListener("change", updateDetailDompet);
  updateDetailDompet(); updateTransferDetail("dari"); updateTransferDetail("ke");

  ["nominal","trfNominal","budgetInput"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", e => {
      e.target.value = e.target.value.replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,".");
    });
  });

  document.getElementById("passwordInput").addEventListener("keydown", e => {
    if (e.key==="Enter") checkPassword();
  });
});
