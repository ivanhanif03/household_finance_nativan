// Ganti URL di bawah dengan URL Web App kamu dari Google Script
const API_URL = "https://script.google.com/macros/s/AKfycbwNP3tep4FXRmHwFmFllqOzsmOvCBqfHTa4_PsieXf46CKQ9-1AkHOqujgwAmpbGdIV/exec";

let income = { suami: 0, istri: 0 };
let budgets = [];
let expenses = [];

// Ambil semua data saat halaman dibuka
window.onload = async function() {
  await loadAllData();
};

// ====== LOAD DATA DARI SHEET ======
async function loadAllData() {
  const [incomeData, budgetData, expenseData] = await Promise.all([
    fetch(`${API_URL}?type=income`).then(r => r.json()).catch(() => []),
    fetch(`${API_URL}?type=budget`).then(r => r.json()).catch(() => []),
    fetch(`${API_URL}?type=expense`).then(r => r.json()).catch(() => [])
  ]);

  if (incomeData.length > 0) {
    const latest = incomeData[incomeData.length - 1];
    income.suami = parseInt(latest.suami);
    income.istri = parseInt(latest.istri);
  }

  budgets = budgetData.map(b => ({ category: b.kategori, amount: parseInt(b.jumlah) }));
  expenses = expenseData.map(e => ({ category: e.kategori, amount: parseInt(e.jumlah) }));

  renderBudgets();
  renderExpenses();
  updateSummary();
}

// ====== SIMPAN KE SHEET ======
async function saveToSheet(type, values) {
  await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ type, values }),
    headers: { "Content-Type": "application/json" }
  });
  await loadAllData();
}

// ====== PENDAPATAN ======
async function saveIncome() {
  income.suami = parseInt(document.getElementById("incomeSuami").value) || 0;
  income.istri = parseInt(document.getElementById("incomeIstri").value) || 0;

  await saveToSheet("income", [income.suami, income.istri, new Date().toLocaleString()]);
  alert("✅ Pendapatan disimpan!");
}

// ====== ANGGARAN ======
async function addBudget() {
  const cat = document.getElementById("category").value;
  const val = parseInt(document.getElementById("budget").value);
  if (!cat || !val) return alert("Lengkapi kategori dan nilai!");

  await saveToSheet("budget", [cat, val, new Date().toLocaleString()]);
  alert("✅ Anggaran ditambah!");
}

// ====== PENGELUARAN ======
async function addExpense() {
  const cat = document.getElementById("expenseCategory").value;
  const val = parseInt(document.getElementById("expenseAmount").value);
  if (!cat || !val) return alert("Lengkapi kategori dan nilai!");

  await saveToSheet("expense", [cat, val, new Date().toLocaleString()]);
  alert("✅ Pengeluaran disimpan!");

  const budget = budgets.find(b => b.category === cat);
  if (budget && val > budget.amount) {
    alert(`⚠️ Pengeluaran kategori ${cat} melebihi anggaran!`);
  }
}

// ====== RENDER UI ======
function renderBudgets() {
  const list = document.getElementById("budgetList");
  list.innerHTML = budgets.map(b => `<li>${b.category}: Rp${b.amount.toLocaleString()}</li>`).join("");
}

function renderExpenses() {
  const list = document.getElementById("expenseList");
  list.innerHTML = expenses.map(e => `<li>${e.category}: Rp${e.amount.toLocaleString()}</li>`).join("");
}

function updateSummary() {
  const totalIncome = income.suami + income.istri;
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const sisa = totalIncome - totalExpense;

  document.getElementById("summary").innerHTML = `
    <p><strong>Total Pendapatan:</strong> Rp${totalIncome.toLocaleString()}</p>
    <p><strong>Total Anggaran:</strong> Rp${totalBudget.toLocaleString()}</p>
    <p><strong>Total Pengeluaran:</strong> Rp${totalExpense.toLocaleString()}</p>
    <p><strong>Sisa Saldo:</strong> Rp${sisa.toLocaleString()}</p>
  `;
}
