/* =============================================
   REPORTS.JS — выборка по фильтру, суммы, форматирование
   ============================================= */

// Записи по фильтру { period, categories, search }, новые сверху
function queryExpenses(filter) {
  const b = periodBounds(filter.period);
  const cats = filter.categories && filter.categories.length ? new Set(filter.categories) : null;
  const q = (filter.search || '').trim().toLowerCase();
  return getExpenses()
    .filter(e =>
      (!b.from || e.date >= b.from) &&
      (!b.to || e.date <= b.to) &&
      (!cats || cats.has(e.category)) &&
      (!q || (e.note || '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q))
    )
    .sort((a, b2) => expenseTime(b2) - expenseTime(a) || b2.id.localeCompare(a.id));
}

function sumTotal(expenses) {
  return Math.round(expenses.reduce((s, e) => s + e.amount, 0) * 100) / 100;
}

// [{ category, amount }] по убыванию суммы
function sumByCategory(expenses) {
  const map = {};
  expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + e.amount; });
  return Object.entries(map)
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

function formatAmount(amount) {
  return amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Целая часть обычным шрифтом, «,XX ₽» — меньше
function formatAmountHTML(amount) {
  const str = formatAmount(amount);
  const i = str.indexOf(',');
  if (i >= 0) {
    return str.slice(0, i) + '<span class="dec">' + str.slice(i) + ' ₽</span>';
  }
  return str + ' <span class="dec">₽</span>';
}

// Подпись времени у записи: сегодня — «15:29», этот год — «24 сент.», раньше — «24 нояб. '25»
function formatEntryWhen(e) {
  if (e.date === getTodayStr()) {
    if (!e.ts) return 'сегодня';
    const d = new Date(e.ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return formatShortDate(e.date);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Категории для выбора при вводе: сначала частые в этом месяце, при равенстве — по алфавиту (как в Depoza)
function categoriesByFrequency() {
  const b = periodBounds({ type: 'month', offset: 0 });
  const count = {};
  getExpenses().forEach(e => {
    if (e.date >= b.from && e.date <= b.to) count[e.category] = (count[e.category] || 0) + 1;
  });
  return [...getCategories()].sort((a, c) =>
    (count[c] || 0) - (count[a] || 0) || a.localeCompare(c, 'ru')
  );
}

function categoriesAlphabetical() {
  return [...getCategories()].sort((a, b) => a.localeCompare(b, 'ru'));
}

// Поиск категории: сначала начинающиеся с текста, потом содержащие его
function searchCategories(list, text) {
  const q = text.trim().toLowerCase();
  if (!q) return list;
  const starts = list.filter(c => c.toLowerCase().startsWith(q));
  const contains = list.filter(c => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q));
  return [...starts.sort((a, b) => a.localeCompare(b, 'ru')), ...contains];
}
