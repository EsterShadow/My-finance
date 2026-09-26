/* =============================================
   BACKUP.JS — резервная копия (JSON) и импорт
   Поддерживаемые форматы импорта:
   1. Собственный бэкап My Finance: { app: "myfinance", expenses, categories }
   2. Экспорт из Depoza (depoza_export.json): { transactions: [{ id, datetime, amount, category, description }], categories }
   Импорт ДОБАВЛЯЕТ данные: записи с уже существующим id пропускаются,
   поэтому повторный импорт того же файла ничего не задвоит.
   ============================================= */

function _downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportBackupJSON() {
  _downloadFile(
    JSON.stringify(buildBackupObject(), null, 1),
    `myfinance_backup_${getTodayStr()}.json`,
    'application/json'
  );
}

// "2026-09-26T16:31:52+03:00" → { date: "2026-09-26", ts: <ms> }
function _parseDepozaDatetime(str) {
  const ts = Date.parse(str);
  if (isNaN(ts)) return null;
  // Дату берём из самой строки (локальное время Depoza), а не пересчитываем
  // через часовой пояс устройства — чтобы трата в 23:30 не уехала на другой день.
  return { date: str.slice(0, 10), ts };
}

function _normalizeImport(json) {
  // Свой бэкап
  if (Array.isArray(json.expenses)) {
    return {
      expenses: json.expenses
        .filter(e => e && e.id && e.date && e.amount > 0 && e.category)
        .map(e => ({
          id: String(e.id),
          amount: Number(e.amount),
          category: String(e.category),
          date: String(e.date),
          note: e.note || '',
          ...(e.ts ? { ts: Number(e.ts) } : {})
        })),
      categories: Array.isArray(json.categories) ? json.categories.map(String) : []
    };
  }

  // Экспорт из Depoza
  if (Array.isArray(json.transactions)) {
    const expenses = [];
    json.transactions.forEach(t => {
      const when = _parseDepozaDatetime(t.datetime);
      const amount = Number(t.amount);
      if (!when || !(amount > 0) || !t.category) return;
      expenses.push({
        // id строится из времени траты — тот же принцип, что у новых записей
        // (Date.now().toString(36)), поэтому сортировка внутри дня сохраняется.
        // Суффикс dz<id> делает id стабильным: повторный импорт не создаст дублей.
        id: when.ts.toString(36) + 'dz' + t.id,
        amount,
        category: String(t.category),
        date: when.date,
        note: t.description || '',
        ts: when.ts
      });
    });
    const cats = Array.isArray(json.categories)
      ? json.categories.map(String)
      : [...new Set(expenses.map(e => e.category))];
    return { expenses, categories: cats };
  }

  return null;
}

// Возвращает { added, skipped, newCategories } или бросает ошибку
function importData(json) {
  const incoming = _normalizeImport(json);
  if (!incoming) throw new Error('Неизвестный формат файла');

  const data = _getData();

  // Первый импорт в пустое приложение: стандартные категории заменяются
  // категориями из файла (в репозитории остаются только 10 стандартных,
  // личный список появляется на устройстве только из твоих данных).
  const replaceCategories = data.expenses.length === 0 && incoming.categories.length > 0;
  if (replaceCategories) data.categories = [];

  const existingIds = new Set(data.expenses.map(e => e.id));
  let added = 0, skipped = 0;

  incoming.expenses.forEach(e => {
    if (existingIds.has(e.id)) { skipped++; return; }
    data.expenses.push(e);
    existingIds.add(e.id);
    added++;
  });

  // Категории: добавляем недостающие (без учёта регистра)
  const lower = new Set(data.categories.map(c => c.toLowerCase()));
  const allCats = [...incoming.categories, ...incoming.expenses.map(e => e.category)];
  let newCategories = 0;
  allCats.forEach(c => {
    if (!lower.has(c.toLowerCase())) {
      data.categories.push(c);
      lower.add(c.toLowerCase());
      newCategories++;
    }
  });

  _saveData(data);
  return { added, skipped, newCategories, replacedCategories: replaceCategories };
}

// Полная замена данных (восстановление из облачной копии)
function replaceAllData(json) {
  const incoming = _normalizeImport(json);
  if (!incoming) throw new Error('Неизвестный формат файла');
  const cats = [];
  const lower = new Set();
  [...incoming.categories, ...incoming.expenses.map(e => e.category)].forEach(c => {
    if (!lower.has(c.toLowerCase())) { lower.add(c.toLowerCase()); cats.push(c); }
  });
  _saveData({ expenses: incoming.expenses, categories: cats });
  return incoming.expenses.length;
}

function buildBackupObject() {
  return {
    app: 'myfinance',
    version: 1,
    exportedAt: new Date().toISOString(),
    expenses: getExpenses(),
    categories: getCategories()
  };
}

function importFromFile(file) {
  return file.text().then(text => importData(JSON.parse(text)));
}
