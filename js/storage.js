/* =============================================
   STORAGE.JS — данные в localStorage
   { expenses: [...], categories: [...], reports: [...] }
   Запись: { id, amount, category, date: 'YYYY-MM-DD', note, ts? }
     ts — время траты в мс (для новых записей всегда есть; у старых может не быть)
   Отчёт: { id, name, pinned, filter }
   Фильтр: { period, categories: null|[...], search: '', mode: 'none'|'entries'|'categories' }
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

function defaultReports() {
  const r = (id, name, period, mode) => ({
    id, name, pinned: false,
    filter: { period, categories: null, search: '', mode }
  });
  return [
    r('r1', 'Месяц', { type: 'month', offset: 0 }, 'categories'),
    r('r2', 'Неделя', { type: 'week', offset: 0 }, 'categories'),
    r('r3', 'Сегодня', { type: 'day', offset: 0 }, 'entries'),
    r('r4', 'Вчера', { type: 'day', offset: -1 }, 'categories')
  ];
}

function _getData() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    data = null;
  }
  if (data && !Array.isArray(data.reports)) data.reports = defaultReports();
  return data;
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
      categories: [...DEFAULT_CATEGORIES],
      reports: defaultReports()
    });
  }
}

function _newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Момент траты: сегодня — текущее время; другая дата — эта дата + текущее время суток (как в Depoza)
function timestampFor(date) {
  const now = new Date();
  if (date === _isoDate(now)) return now.getTime();
  const d = _parseISO(date);
  d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
  return d.getTime();
}

// Ключ сортировки записи (новые — больше)
function expenseTime(e) {
  return e.ts || _parseISO(e.date).getTime() + 12 * 3600000;
}

// ---- Записи ----

function getExpenses() {
  return _getData().expenses || [];
}

function addExpense(amount, category, date, note) {
  const data = _getData();
  const expense = {
    id: _newId(),
    amount: Math.round(parseFloat(amount) * 100) / 100,
    category,
    date,
    note: note || '',
    ts: timestampFor(date)
  };
  data.expenses.push(expense);
  _saveData(data);
  return expense;
}

function updateExpense(id, patch) {
  const data = _getData();
  const e = data.expenses.find(x => x.id === id);
  if (!e) return;
  if (patch.date && patch.date !== e.date) {
    // дата изменилась — время суток сохраняем, если оно было
    const t = e.ts ? new Date(e.ts) : new Date();
    const d = _parseISO(patch.date);
    d.setHours(t.getHours(), t.getMinutes(), t.getSeconds(), 0);
    e.ts = d.getTime();
  }
  Object.assign(e, patch);
  _saveData(data);
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

function findCategory(name) {
  const n = name.trim().toLowerCase();
  return getCategories().find(c => c.toLowerCase() === n) || null;
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

// Переименование: меняется и в записях, и в фильтрах отчётов
function renameCategory(oldName, newName) {
  const data = _getData();
  const trimmed = newName.trim();
  if (!trimmed) return false;
  const clash = data.categories.find(c => c.toLowerCase() === trimmed.toLowerCase() && c !== oldName);
  if (clash) return false;
  data.categories = data.categories.map(c => c === oldName ? trimmed : c);
  data.expenses.forEach(e => { if (e.category === oldName) e.category = trimmed; });
  data.reports.forEach(r => {
    if (r.filter.categories) r.filter.categories = r.filter.categories.map(c => c === oldName ? trimmed : c);
  });
  _saveData(data);
  return true;
}

function countExpensesInCategory(name) {
  return getExpenses().filter(e => e.category === name).length;
}

// Удаление категории вместе с её записями (как в Depoza — с предупреждением в интерфейсе)
function deleteCategory(name) {
  const data = _getData();
  data.categories = data.categories.filter(c => c !== name);
  data.expenses = data.expenses.filter(e => e.category !== name);
  data.reports.forEach(r => {
    if (r.filter.categories) {
      r.filter.categories = r.filter.categories.filter(c => c !== name);
      if (!r.filter.categories.length) r.filter.categories = null;
    }
  });
  _saveData(data);
}

// ---- Отчёты ----

function getReports() {
  return _getData().reports;
}

function saveReport(report) {
  const data = _getData();
  if (!report.id) {
    report.id = _newId();
    data.reports.push(report);
  } else {
    const i = data.reports.findIndex(r => r.id === report.id);
    if (i >= 0) data.reports[i] = report; else data.reports.push(report);
  }
  _saveData(data);
  return report;
}

function deleteReport(id) {
  const data = _getData();
  data.reports = data.reports.filter(r => r.id !== id);
  _saveData(data);
}

// Закреплённым может быть только один отчёт
function togglePinReport(id) {
  const data = _getData();
  data.reports.forEach(r => { r.pinned = r.id === id ? !r.pinned : false; });
  _saveData(data);
}
