/* =============================================
   STORAGE.JS — работа с localStorage
   ============================================= */

const STORAGE_KEY = 'myfinance_v1';

const DEFAULT_CATEGORIES = [
  'Продукты питания',
  'Жильё и ЖКХ',
  'Транспорт',
  'Кафе и рестораны',
  'Здоровье',
  'Одежда и обувь',
  'Развлечения',
  'Красота и уход',
  'Связь',
  'Подарки'
];

function _getData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    return null;
  }
}

function _saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // Автокопия в Dropbox после каждого изменения (см. cloud.js)
  if (typeof cloudScheduleBackup === 'function') cloudScheduleBackup();
}

function initData() {
  if (!_getData()) {
    _saveData({
      expenses: [],
      categories: [...DEFAULT_CATEGORIES]
    });
  }
}

// ---- Расходы ----

function getExpenses() {
  return _getData().expenses || [];
}

function addExpense(amount, category, date, note) {
  const data = _getData();
  const expense = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    amount: parseFloat(amount),
    category,
    date,
    note: note || ''
  };
  data.expenses.push(expense);
  _saveData(data);
  return expense;
}

function deleteExpense(id) {
  const data = _getData();
  data.expenses = data.expenses.filter(e => e.id !== id);
  _saveData(data);
}

// ---- Категории ----

function getCategories() {
  return _getData().categories || [];
}

function addCategory(name) {
  const data = _getData();
  const trimmed = name.trim();
  if (trimmed && !data.categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
    data.categories.push(trimmed);
    _saveData(data);
    return true;
  }
  return false;
}

function deleteCategory(name) {
  const data = _getData();
  data.categories = data.categories.filter(c => c !== name);
  _saveData(data);
}
