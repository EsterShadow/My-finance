/* =============================================
   EXPENSES.JS — экран «Расходы» (ввод траты, как в Depoza)
   Дата (тап — календарь), сумма, категория (поиск; нет такой — ✓ создать),
   описание появляется после выбора категории. «Новая запись» проверяет
   сумму и категорию, после сохранения форма очищается для следующей траты.
   ============================================= */

const exp = {
  date: null,       // 'YYYY-MM-DD'
  category: null
};

function _dateLabel(iso) {
  if (iso === getTodayStr()) return 'сегодня';
  if (iso === getYesterdayStr()) return 'вчера';
  return formatShortDate(iso);
}

function renderExpenseForm() {
  const search = document.getElementById('category-search');
  const list = document.getElementById('category-list');
  const noteRow = document.getElementById('note-row');
  const addBtn = document.getElementById('btn-add-category');
  const clearBtn = document.getElementById('btn-clear-category');

  document.getElementById('expense-date-label').textContent = _dateLabel(exp.date);

  if (exp.category) {
    search.value = exp.category;
    search.readOnly = true;
    list.classList.add('hidden');
    noteRow.classList.remove('hidden');
    addBtn.classList.add('hidden');
    clearBtn.classList.remove('hidden');
    return;
  }

  search.readOnly = false;
  list.classList.remove('hidden');
  noteRow.classList.add('hidden');
  clearBtn.classList.add('hidden');

  const text = search.value;
  const cats = searchCategories(categoriesByFrequency(), text);
  list.innerHTML = '';
  cats.forEach(c => {
    const item = document.createElement('button');
    item.className = 'category-item';
    item.textContent = c;
    item.addEventListener('click', () => selectExpenseCategory(c));
    list.appendChild(item);
  });
  const t = text.trim();
  addBtn.classList.toggle('hidden', !t || !!findCategory(t));
}

function selectExpenseCategory(c) {
  exp.category = c;
  renderExpenseForm();
  const amount = document.getElementById('amount-input');
  if (!amount.value.trim()) amount.focus();
  else document.getElementById('note-input').focus();
}

function _parseAmount(raw) {
  const v = parseFloat(String(raw).replace(/\s/g, '').replace(',', '.'));
  return isFinite(v) ? v : NaN;
}

function saveExpenseFromForm() {
  const amount = _parseAmount(document.getElementById('amount-input').value);
  if (!(amount > 0)) { showToast('Укажите сумму'); document.getElementById('amount-input').focus(); return; }
  if (!exp.category) { showToast('Укажите категорию'); document.getElementById('category-search').focus(); return; }

  addExpense(amount, exp.category, exp.date, document.getElementById('note-input').value.trim());

  document.getElementById('amount-input').value = '';
  document.getElementById('note-input').value = '';
  document.getElementById('category-search').value = '';
  exp.category = null;
  exp.date = getTodayStr();
  renderExpenseForm();
  showToast('Запись успешно добавлена');
  document.getElementById('amount-input').focus();
}

function initExpensesScreen() {
  exp.date = getTodayStr();
  makeAmountField(document.getElementById('amount-input'));
  makeTextField(document.getElementById('category-search'));
  makeTextField(document.getElementById('note-input'));
  // тап по строке суммы (в т.ч. по ₽) — фокус в поле
  document.querySelector('.amount-line').addEventListener('click', e => {
    if (e.target.id !== 'amount-input') document.getElementById('amount-input').focus();
  });

  document.getElementById('expense-date-label').addEventListener('click', () => {
    pickDate(exp.date, d => { exp.date = d; renderExpenseForm(); });
  });

  document.getElementById('category-search').addEventListener('input', () => {
    if (!exp.category) renderExpenseForm();
  });
  document.getElementById('category-search').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || exp.category) return;
    const t = e.target.value.trim();
    const found = t && findCategory(t);
    if (found) selectExpenseCategory(found);
  });

  document.getElementById('btn-add-category').addEventListener('click', () => {
    const name = document.getElementById('category-search').value.trim();
    if (!name) return;
    if (addCategory(name)) selectExpenseCategory(name);
    else showToast('Категория уже существует');
  });

  document.getElementById('btn-clear-category').addEventListener('click', () => {
    exp.category = null;
    const s = document.getElementById('category-search');
    s.value = '';
    renderExpenseForm();
    s.focus();
  });

  document.getElementById('btn-save-expense').addEventListener('click', saveExpenseFromForm);
  document.getElementById('note-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveExpenseFromForm();
  });

  renderExpenseForm();
}

// Дата «сегодня» после полуночи должна обновиться, если приложение не закрывали
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && exp.date && exp.date < getTodayStr()
      && !document.getElementById('amount-input').value) {
    exp.date = getTodayStr();
    renderExpenseForm();
  }
});
