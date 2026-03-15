/* =============================================
   REPORTS.JS — расчёты по периодам
   ============================================= */

function _isoDate(date) {
  // Возвращает YYYY-MM-DD без смещения часового пояса
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayStr() {
  return _isoDate(new Date());
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return _isoDate(d);
}

function _offsetDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return _isoDate(d);
}

function getExpensesForPeriod(period) {
  const expenses = getExpenses();
  const today = getTodayStr();

  switch (period) {
    case 'today':
      return expenses.filter(e => e.date === today);

    case 'yesterday':
      return expenses.filter(e => e.date === getYesterdayStr());

    case 'week': {
      const from = _offsetDate(-6);
      return expenses.filter(e => e.date >= from && e.date <= today);
    }

    case 'month': {
      const d = new Date();
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      return expenses.filter(e => e.date >= from && e.date <= today);
    }

    case 'year': {
      const from = `${new Date().getFullYear()}-01-01`;
      return expenses.filter(e => e.date >= from && e.date <= today);
    }

    default:
      return [];
  }
}

function sumTotal(expenses) {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

function sumByCategory(expenses) {
  const map = {};
  expenses.forEach(e => {
    map[e.category] = (map[e.category] || 0) + e.amount;
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ category, amount }));
}

function formatAmount(amount) {
  return amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Сумма для вставки в innerHTML: целая часть обычным шрифтом, ",XX ₽" — меньше
function formatAmountHTML(amount) {
  const str = formatAmount(amount);
  const i = str.indexOf(',');
  if (i >= 0) {
    return str.slice(0, i) + '<span class="dec">' + str.slice(i) + '\u00a0₽</span>';
  }
  return str + '\u00a0<span class="dec">₽</span>';
}
