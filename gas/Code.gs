// =====================================================
// KEUANGAN NATIVAN — Code.gs v4
// Fitur: addTransaksi, addTransfer, setBudget (periode 25-24), getData
// =====================================================

function doGet(e) {
  if (!e || !e.parameter) return jsonOut({ status:"ERROR", message:"No parameter" });
  const action = e.parameter.action || "getData";
  if (action === "addTransaksi") return handleAddTransaksi(e.parameter);
  if (action === "addTransfer")  return handleAddTransfer(e.parameter);
  if (action === "setBudget")    return handleSetBudget(e.parameter);
  return handleGetData();
}

function doPost(e) {
  try {
    let p = {};
    if (e.parameter && e.parameter.action) p = e.parameter;
    else if (e.postData && e.postData.contents) p = JSON.parse(e.postData.contents);
    else return jsonOut({ status:"ERROR", message:"No data" });
    const action = p.action || "";
    if (action === "addTransaksi") return handleAddTransaksi(p);
    if (action === "addTransfer")  return handleAddTransfer(p);
    if (action === "setBudget")    return handleSetBudget(p);
    if (action === "getData")      return handleGetData();
    return jsonOut({ status:"ERROR", message:"Unknown action: " + action });
  } catch(err) {
    return jsonOut({ status:"ERROR", message:"doPost: " + err.toString() });
  }
}

// ─── Tambah Transaksi ────────────────────────────
function handleAddTransaksi(p) {
  try {
    if (!p.kategori || !p.nominal) return jsonOut({ status:"ERROR", message:"kategori & nominal wajib" });
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Transaksi");
    if (!sheet) return jsonOut({ status:"ERROR", message:"Sheet 'Transaksi' tidak ditemukan" });
    sheet.appendRow([
      new Date(), p.jenis||"", p.kategori||"", p.deskripsi||"",
      Number(p.nominal)||0, p.dompet||"", p.dompetDetail||"", p.kepemilikan||""
    ]);
    return jsonOut({ status:"OK" });
  } catch(err) {
    return jsonOut({ status:"ERROR", message:"addTransaksi: " + err.toString() });
  }
}

// ─── Pindah Dana / Transfer ──────────────────────
function handleAddTransfer(p) {
  try {
    if (!p.nominal) return jsonOut({ status:"ERROR", message:"nominal wajib" });
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Transaksi");
    if (!sheet) return jsonOut({ status:"ERROR", message:"Sheet 'Transaksi' tidak ditemukan" });
    const now             = new Date();
    const nominal         = Number(p.nominal) || 0;
    const catatan         = p.catatan || "Pindah Dana";
    const dariKepemilikan = p.dariKepemilikan || p.kepemilikan || "";
    const keKepemilikan   = p.keKepemilikan   || p.kepemilikan || "";

    // Baris keluar dari dompet asal
    sheet.appendRow([now, "Transfer-Keluar", catatan,
      `${dariKepemilikan} → ${keKepemilikan} | ${p.dariDetail} → ${p.keDetail}`,
      nominal, p.dariDompet||"", p.dariDetail||"", dariKepemilikan]);

    // Baris masuk ke dompet tujuan
    sheet.appendRow([now, "Transfer-Masuk", catatan,
      `${dariKepemilikan} → ${keKepemilikan} | ${p.dariDetail} → ${p.keDetail}`,
      nominal, p.keDompet||"", p.keDetail||"", keKepemilikan]);

    return jsonOut({ status:"OK" });
  } catch(err) {
    return jsonOut({ status:"ERROR", message:"addTransfer: " + err.toString() });
  }
}

// ─── Set Budget (support periodeKey DAN bulan/tahun lama) ──
function handleSetBudget(p) {
  try {
    if (!p.budget) return jsonOut({ status:"ERROR", message:"budget wajib diisi" });

    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Budget");
    if (!sheet) return jsonOut({ status:"ERROR", message:"Sheet 'Budget' tidak ditemukan" });

    // Tentukan periodeKey — support format baru (periodeKey) dan lama (bulan/tahun)
    let periodeKey   = p.periodeKey || "";
    let periodeLabel = p.periodeLabel || "";

    if (!periodeKey && p.bulan && p.tahun) {
      // Konversi bulan/tahun lama ke periodeKey format "YYYY-MM-25"
      periodeKey = `${p.tahun}-${String(p.bulan).padStart(2,"0")}-25`;
    }

    if (!periodeKey) return jsonOut({ status:"ERROR", message:"periodeKey atau bulan/tahun wajib diisi" });

    const rows   = sheet.getDataRange().getValues();
    const budget = Number(p.budget);
    let found    = false;

    for (let i = 1; i < rows.length; i++) {
      // Cocokkan kolom A (periodeKey) atau kolom A+B (bulan+tahun lama)
      if (String(rows[i][0]) === periodeKey ||
          (String(rows[i][0]) === String(p.bulan) && String(rows[i][1]) === String(p.tahun))) {
        sheet.getRange(i+1, 3).setValue(budget);
        // Jika row lama (pakai bulan/tahun), update kolom A ke periodeKey baru
        if (String(rows[i][0]) !== periodeKey) {
          sheet.getRange(i+1, 1).setValue(periodeKey);
          sheet.getRange(i+1, 2).setValue(periodeLabel);
        }
        found = true; break;
      }
    }

    if (!found) {
      sheet.appendRow([periodeKey, periodeLabel, budget, 0]);
    }
    return jsonOut({ status:"OK" });
  } catch(err) {
    return jsonOut({ status:"ERROR", message:"setBudget: " + err.toString() });
  }
}

// ─── Get Data ────────────────────────────────────
function handleGetData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Sheet Transaksi
    const sheetTrx  = ss.getSheetByName("Transaksi");
    if (!sheetTrx) return jsonOut({ status:"ERROR", message:"Sheet 'Transaksi' tidak ditemukan" });
    const dataTrx   = sheetTrx.getDataRange().getValues();
    const transaksi = [];

    for (let i = 1; i < dataTrx.length; i++) {
      if (!dataTrx[i][0] && !dataTrx[i][2]) continue;
      transaksi.push({
        tanggal:      Utilities.formatDate(new Date(dataTrx[i][0]), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"),
        jenis:        String(dataTrx[i][1]||""),
        kategori:     String(dataTrx[i][2]||""),
        deskripsi:    String(dataTrx[i][3]||""),
        nominal:      Number(dataTrx[i][4])||0,
        dompet:       String(dataTrx[i][5]||""),
        dompetDetail: String(dataTrx[i][6]||"Tidak Ada"),
        kepemilikan:  String(dataTrx[i][7]||""),
      });
    }

    // Sheet Budget (kolom: periodeKey, periodeLabel, budget, realisasi)
    const sheetBudget = ss.getSheetByName("Budget");
    if (!sheetBudget) return jsonOut({ status:"ERROR", message:"Sheet 'Budget' tidak ditemukan" });
    const dataBudget  = sheetBudget.getDataRange().getValues();
    const budget      = [];

    for (let i = 1; i < dataBudget.length; i++) {
      if (!dataBudget[i][0]) continue;
      budget.push({
        periodeKey:   String(dataBudget[i][0]),
        periodeLabel: String(dataBudget[i][1]||""),
        budget:       Number(dataBudget[i][2])||0,
        realisasi:    Number(dataBudget[i][3])||0,
      });
    }

    // Auto-buat baris periode aktif jika belum ada
    const now      = new Date();
    const d        = now.getDate();
    const periodeStartMonth = d >= 25 ? now.getMonth() : now.getMonth()-1;
    const periodeStartYear  = (periodeStartMonth < 0) ? now.getFullYear()-1 : now.getFullYear();
    const psMonth   = ((periodeStartMonth % 12) + 12) % 12;
    const key       = `${periodeStartYear}-${String(psMonth+1).padStart(2,"0")}-25`;

    if (!budget.find(b => b.periodeKey === key)) {
      // Carry over budget dari periode sebelumnya
      let lastBudget = 0;
      for (let i = budget.length-1; i >= 0; i--) {
        if (budget[i].budget > 0) { lastBudget = budget[i].budget; break; }
      }
      sheetBudget.appendRow([key, "", lastBudget, 0]);
      budget.push({ periodeKey:key, periodeLabel:"", budget:lastBudget, realisasi:0 });
    }

    return jsonOut({ status:"OK", transaksi, budget });
  } catch(err) {
    return jsonOut({ status:"ERROR", message:"getData: " + err.toString() });
  }
}

// ─── Helper ──────────────────────────────────────
function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
