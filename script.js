let income = { suami: 0, istri: 0 };
let budgets = [];
let expenses = [];

// Simpan pendapatan
function saveIncome() {
  income.suami = parseInt(document.getElementById("incomeSuami").value) || 0;
  income.istri = parseInt(document.getElementById("incomeIstri").value) || 0;
  alert("✅ Pendapatan tersimpan!");
  updateSummary();
}

// Tambah anggaran
function addBudget() {
  const cat = document.getElementById("category").value;
  const val = parseInt(document.getElementById("budget").value);
  if (!cat || !val) return alert("Lengkapi kategori dan nilai!");

  budgets.push({ category: cat, amount: val });
  renderBudgets();
  updateSummary();
}

// Tambah pengeluaran
function addExpense() {
  const cat = document.getElementById("expenseCategory").value;
  const val = parseInt(document.getElementById("expenseAmount").value);
  if (!cat || !val) return alert("Lengkapi kategori dan nilai!");

  expenses.push({ category: cat, amount: val });
  renderExpenses();
  updateSummary();

  const budget = budgets.find(b => b.category === cat);
  if (budget && val > budget.amount) {
    alert(`⚠️ Pengeluaran kategori ${cat} melebihi anggaran!`);
  }
}

// Tampilkan anggaran
function renderBudgets() {
  const list = document.getElementById("budgetList");
  list.innerHTML = budgets.map(b => `<li>${b.category}: Rp${b.amount.toLocaleString()}</li>`).join("");
}

// Tampilkan pengeluaran
function renderExpenses() {
  const list = document.getElementById("expenseList");
  list.innerHTML = expenses.map(e => `<li>${e.category}: Rp${e.amount.toLocaleString()}</li>`).join("");
}

// Update ringkasan
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
