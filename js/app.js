/* =============================================
   APP.JS — навигация, UI, обработчики событий
   ============================================= */

// ---- Состояние ----
const state = {
  activeTab: 'expenses',
  selectedCategory: null,
  expenseDate: getTodayStr(),
  showYear: false,
  longPressTimer: null,
  longPressedCat: null
};

// ---- Утилиты ----

function formatDisplayDate(isoDate) {
  const today = getTodayStr();
  const yesterday = getYesterdayStr();
  if (isoDate === today) return 'сегодня';
  if (isoDate === yesterday) return 'вчера';
  const d = new Date(isoDate + 'T12:00:00');
  const thisYear = new Date().getFullYear();
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== thisYear ? { year: 'numeric' } : {})
  });
}

function formatHistoryDate(isoDate) {
  const today = getTodayStr();
  const yesterday = getYesterdayStr();
  if (isoDate === today) return 'Сегодня';
  if (isoDate === yesterday) return 'Вчера';
  const d = new Date(isoDate + 'T12:00:00');
  const thisYear = new Date().getFullYear();
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== thisYear ? { year: 'numeric' } : {})
  });
}

// ---- Навигация ----

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`tab-${tabId}`).classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tabId}"]`).classList.add('active');

  state.activeTab = tabId;

  if (tabId === 'reports') renderReports();
  if (tabId === 'history') renderHistory();
}

// =============================================
// ЭКРАН: РАСХОДЫ
// =============================================

function initExpensesScreen() {
  // Дата
  const dateLabel = document.getElementById('expense-date-label');
  const dateInput = document.getElementById('expense-date-input');
  dateInput.value = state.expenseDate;

  dateLabel.addEventListener('click', () => dateInput.showPicker?.() || dateInput.click());
  dateInput.addEventListener('change', e => {
    state.expenseDate = e.target.value || getTodayStr();
    dateLabel.textContent = formatDisplayDate(state.expenseDate);
  });

  // Сумма
  const amountInput = document.getElementById('amount-input');
  amountInput.addEventListener('input', updateSaveBtn);

  // Поиск категории
  const catSearch = document.getElementById('category-search');
  catSearch.addEventListener('input', () => {
    state.selectedCategory = null;
    renderCategoryList(catSearch.value);
    updateSaveBtn();
  });

  // Кнопка добавить категорию
  document.getElementById('btn-add-category').addEventListener('click', () => {
    const name = document.getElementById('category-search').value.trim();
    if (name && addCategory(name)) {
      state.selectedCategory = name;
      document.getElementById('category-search').value = name;
      renderCategoryList('');
      updateSaveBtn();
    }
  });

  // Заметка
  document.getElementById('note-input').addEventListener('input', updateSaveBtn);

  // Кнопка сохранить
  document.getElementById('btn-save-expense').addEventListener('click', saveExpense);

  // Начальный рендер
  renderCategoryList('');
}

function renderCategoryList(filter) {
  const catList  = document.getElementById('category-list');
  const noteRow  = document.getElementById('note-row');
  const addBtn   = document.getElementById('btn-add-category');

  // Категория выбрана — прячем список, показываем заметку
  if (state.selectedCategory) {
    catList.classList.add('hidden');
    noteRow.classList.remove('hidden');
    addBtn.classList.add('hidden');
    return;
  }

  // Категория не выбрана — показываем список, прячем заметку
  catList.classList.remove('hidden');
  noteRow.classList.add('hidden');

  const categories = getCategories();
  const q = (filter || '').trim().toLowerCase();
  const filtered = q ? categories.filter(c => c.toLowerCase().includes(q)) : categories;

  catList.innerHTML = '';

  filtered.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'category-item';
    item.dataset.name = cat;
    item.textContent = cat;

    // Тап — выбрать категорию
    item.addEventListener('click', () => {
      if (state.longPressedCat) {
        state.longPressedCat = null;
        return;
      }
      state.selectedCategory = cat;
      document.getElementById('category-search').value = cat;
      renderCategoryList('');
      updateSaveBtn();
    });

    // Long press — показать кнопку удаления
    item.addEventListener('pointerdown', () => {
      state.longPressTimer = setTimeout(() => {
        state.longPressedCat = cat;
        showCategoryDeleteBtn(item, cat);
      }, 600);
    });

    item.addEventListener('pointerup',   () => clearTimeout(state.longPressTimer));
    item.addEventListener('pointerleave', () => clearTimeout(state.longPressTimer));
    item.addEventListener('pointermove',  () => clearTimeout(state.longPressTimer));

    catList.appendChild(item);
  });

  // Кнопка «Добавить новую»
  const val = document.getElementById('category-search').value.trim();
  const exactMatch = categories.some(c => c.toLowerCase() === val.toLowerCase());
  addBtn.classList.toggle('hidden', !val || exactMatch);
}

function showCategoryDeleteBtn(item, catName) {
  // Убираем старые кнопки удаления
  document.querySelectorAll('.btn-delete-cat').forEach(b => b.remove());
  document.querySelectorAll('.category-item.long-pressed').forEach(i => i.classList.remove('long-pressed'));

  item.classList.add('long-pressed');

  const btn = document.createElement('button');
  btn.className = 'btn-delete-cat';
  btn.textContent = 'Удалить';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (confirm(`Удалить категорию «${catName}»?\nЗаписи с этой категорией останутся в истории.`)) {
      if (state.selectedCategory === catName) state.selectedCategory = null;
      deleteCategory(catName);
      renderCategoryList(document.getElementById('category-search').value);
      updateSaveBtn();
    }
  });

  item.appendChild(btn);
}

function updateSaveBtn() {
  const raw = document.getElementById('amount-input').value.replace(',', '.');
  const amount = parseFloat(raw);
  const ok = amount > 0 && !!state.selectedCategory;
  document.getElementById('btn-save-expense').disabled = !ok;
}

function saveExpense() {
  const raw = document.getElementById('amount-input').value.replace(',', '.');
  const amount = parseFloat(raw);
  if (!amount || !state.selectedCategory) return;

  const note = document.getElementById('note-input').value.trim();
  addExpense(amount, state.selectedCategory, state.expenseDate, note);

  // Сброс формы
  document.getElementById('amount-input').value = '';
  document.getElementById('note-input').value = '';
  document.getElementById('category-search').value = '';
  state.selectedCategory = null;
  state.expenseDate = getTodayStr();
  document.getElementById('expense-date-input').value = state.expenseDate;
  document.getElementById('expense-date-label').textContent = 'сегодня';

  renderCategoryList('');
  updateSaveBtn();
}

// =============================================
// ЭКРАН: ОТЧЁТЫ
// =============================================

const REPORT_PERIODS = [
  { id: 'today',     label: 'Сегодня', type: 'entries' },
  { id: 'yesterday', label: 'Вчера',   type: 'entries' },
  { id: 'week',      label: 'Неделя',  type: 'categories' },
  { id: 'month',     label: 'Месяц',   type: 'categories' }
];

function renderReports() {
  const container = document.getElementById('reports-list');
  container.innerHTML = '';

  const periods = state.showYear
    ? [...REPORT_PERIODS, { id: 'year', label: 'Год', type: 'categories' }]
    : REPORT_PERIODS;

  periods.forEach(p => {
    const card = buildReportCard(p);
    container.appendChild(card);
  });

  document.getElementById('btn-new-report').style.display = state.showYear ? 'none' : '';
}

function buildReportCard(period) {
  const expenses = getExpensesForPeriod(period.id);
  const total = sumTotal(expenses);

  const card = document.createElement('div');
  card.className = 'report-card';

  // Шапка
  const top = document.createElement('div');
  top.className = 'report-card-top';
  top.innerHTML = `
    <span class="report-total">${formatAmountHTML(total)}</span>
    <div class="report-card-icons">
      <span>📌</span>
      <span>⋮</span>
    </div>
  `;
  card.appendChild(top);

  // Период
  const period_label = document.createElement('div');
  period_label.className = 'report-period';
  period_label.textContent = period.label;
  card.appendChild(period_label);

  // Строки
  const rows = document.createElement('div');
  rows.className = 'report-rows';

  if (expenses.length === 0) {
    rows.innerHTML = '<span class="report-empty-note">Нет данных</span>';
  } else if (period.type === 'entries') {
    const sorted = [...expenses].sort((a, b) =>
      b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    );
    sorted.slice(0, 5).forEach(e => {
      const row = document.createElement('div');
      row.className = 'report-row';
      row.innerHTML = `
        <span class="report-row-label">${e.note || e.category}</span>
        <span class="report-row-amount">${formatAmountHTML(e.amount)}</span>
      `;
      rows.appendChild(row);
    });
  } else {
    rows.className = 'report-top3';
    sumByCategory(expenses).slice(0, 3).forEach(({ category, amount }) => {
      const item = document.createElement('div');
      item.className = 'report-top3-item';
      item.innerHTML = `
        <span class="report-top3-amount">${formatAmountHTML(amount)}</span>
        <span class="report-top3-label">${category}</span>
      `;
      rows.appendChild(item);
    });
  }

  card.appendChild(rows);

  // Клик → детализация
  card.addEventListener('click', () => openReportModal(period));

  return card;
}

function openReportModal(period) {
  const expenses = getExpensesForPeriod(period.id);
  const total = sumTotal(expenses);

  document.getElementById('modal-title').innerHTML =
    `${period.label} — ${formatAmountHTML(total)}`;

  const body = document.getElementById('modal-body');
  body.innerHTML = '';

  if (expenses.length === 0) {
    body.innerHTML = '<div class="modal-empty">Нет данных за этот период</div>';
  } else {
    sumByCategory(expenses).forEach(({ category, amount }) => {
      const row = document.createElement('div');
      row.className = 'modal-row';
      row.innerHTML = `
        <span class="modal-row-label">${category}</span>
        <span class="modal-row-amount">${formatAmountHTML(amount)}</span>
      `;
      body.appendChild(row);
    });
  }

  document.getElementById('modal').classList.remove('hidden');
}

// =============================================
// ЭКРАН: ИСТОРИЯ
// =============================================

function renderHistory(filter) {
  const q = (filter || '').trim().toLowerCase();
  let expenses = getExpenses();

  if (q) {
    expenses = expenses.filter(e =>
      e.category.toLowerCase().includes(q) ||
      (e.note && e.note.toLowerCase().includes(q))
    );
  }

  const container = document.getElementById('history-list');
  container.innerHTML = '';

  if (expenses.length === 0) {
    container.innerHTML = '<div class="history-empty">Нет записей</div>';
    return;
  }

  // Группировка по дате
  const byDate = {};
  expenses.forEach(e => {
    (byDate[e.date] = byDate[e.date] || []).push(e);
  });

  Object.keys(byDate)
    .sort((a, b) => b.localeCompare(a))
    .forEach(date => {
      const dayExpenses = byDate[date].sort((a, b) => b.id.localeCompare(a.id));
      const dayTotal = sumTotal(dayExpenses);

      // Заголовок дня
      const header = document.createElement('div');
      header.className = 'history-day-header';
      header.innerHTML = `
        <span class="history-day-date">${formatHistoryDate(date)}</span>
        <span class="history-day-total">${formatAmountHTML(dayTotal)}</span>
      `;
      container.appendChild(header);

      // Строки
      dayExpenses.forEach(e => {
        const row = document.createElement('div');
        row.className = 'history-row';
        row.innerHTML = `
          <div class="history-row-info">
            <div class="history-row-main">
              <span class="history-category">${e.category}</span>
              <span class="history-amount">${formatAmountHTML(e.amount)}</span>
            </div>
            ${e.note ? `<div class="history-note">${e.note}</div>` : ''}
          </div>
          <button class="btn-delete-expense" data-id="${e.id}" aria-label="Удалить">✕</button>
        `;

        row.querySelector('.btn-delete-expense').addEventListener('click', ev => {
          ev.stopPropagation();
          if (confirm('Удалить эту запись?')) {
            deleteExpense(e.id);
            renderHistory(document.getElementById('history-search').value);
            if (state.activeTab === 'reports') renderReports();
          }
        });

        container.appendChild(row);
      });
    });
}

// =============================================
// iOS ПОДСКАЗКА
// =============================================

function maybeShowIOSHint() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone;
  const dismissed = localStorage.getItem('ios_hint_dismissed');
  if (isIOS && !isStandalone && !dismissed) {
    document.getElementById('ios-hint').classList.remove('hidden');
  }
}

// =============================================
// ИНИЦИАЛИЗАЦИЯ
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  initData();

  // Навигация
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Экран расходов
  initExpensesScreen();

  // Новый отчёт (добавить год)
  document.getElementById('btn-new-report').addEventListener('click', () => {
    state.showYear = true;
    renderReports();
  });

  // Поиск в истории
  document.getElementById('history-search').addEventListener('input', e => {
    renderHistory(e.target.value);
  });

  // Экспорт CSV
  document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);

  // Модальное окно — закрытие
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
  });
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) {
      document.getElementById('modal').classList.add('hidden');
    }
  });

  // iOS подсказка
  document.getElementById('ios-hint-close').addEventListener('click', () => {
    document.getElementById('ios-hint').classList.add('hidden');
    localStorage.setItem('ios_hint_dismissed', '1');
  });
  maybeShowIOSHint();

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Активный таб по умолчанию — Расходы
  renderCategoryList('');
});
