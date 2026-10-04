/* =============================================
   EDITOR.JS — редактирование записи и выбор категории
   Диалог как в Depoza: дата, сумма, категория ◢, описание,
   снизу оранжевая полоса «Удалить | Сохранить».
   ============================================= */

function openExpenseEditor(expense, onDone) {
  const st = { date: expense.date, category: expense.category };
  const box = document.createElement('div');
  box.className = 'dialog expense-editor';
  box.innerHTML = `
    <div class="editor-body">
      <button class="date-label js-date"></button>
      <div class="amount-input editor-amount js-amount" contenteditable="true" inputmode="decimal" enterkeyhint="done" role="textbox" aria-label="Сумма" data-placeholder="0,00"></div>
      <button class="editor-category js-cat"></button>
      <input class="field-input editor-note js-note" placeholder="Описание" value="${escapeHTML(expense.note || '')}">
    </div>
    <div class="editor-actions">
      <button class="js-delete">${ICONS.trash}<span>Удалить</span></button>
      <span class="editor-actions-sep"></span>
      <button class="js-save">${ICONS.check}<span>Сохранить</span></button>
    </div>
  `;
  const $ = s => box.querySelector(s);
  makeAmountField($('.js-amount'));
  $('.js-amount').value = formatAmount(expense.amount).replace(/\s/g, '');
  const render = () => {
    $('.js-date').textContent = _dateLabel(st.date);
    $('.js-cat').textContent = st.category;
  };

  $('.js-date').addEventListener('click', () => pickDate(st.date, d => { st.date = d; render(); }));
  $('.js-cat').addEventListener('click', () => openCategoryChooser(c => { st.category = c; render(); }));
  $('.js-delete').addEventListener('click', () => {
    if (!confirm('Удалить запись?')) return;
    deleteExpense(expense.id);
    popLayer(true);
    if (onDone) onDone();
  });
  $('.js-save').addEventListener('click', () => {
    const amount = _parseAmount($('.js-amount').value);
    if (!(amount > 0)) { showToast('Укажите сумму'); return; }
    updateExpense(expense.id, {
      amount: Math.round(amount * 100) / 100,
      category: st.category,
      date: st.date,
      note: $('.js-note').value.trim()
    });
    popLayer(true);
    if (onDone) onDone();
  });

  render();
  openDialog(box);
}

// Полноэкранный выбор категории (частые сверху, поиск, ✓ — создать новую)
function openCategoryChooser(onPick) {
  const el = document.createElement('div');
  el.className = 'screen screen-light';
  el.innerHTML = `
    <div class="screen-header light">
      <button class="icon-btn js-back" aria-label="Назад">${ICONS.back}</button>
      <input class="screen-search js-q" placeholder="Начните вводить категорию" autocomplete="off">
      <button class="icon-btn js-add hidden" aria-label="Создать категорию">${ICONS.check}</button>
    </div>
    <div class="screen-body js-list"></div>
  `;
  const $ = s => el.querySelector(s);
  const pick = c => { popLayer(true); onPick(c); };
  const render = () => {
    const q = $('.js-q').value;
    const list = $('.js-list');
    list.innerHTML = '';
    searchCategories(categoriesByFrequency(), q).forEach(c => {
      const b = document.createElement('button');
      b.className = 'category-item';
      b.textContent = c;
      b.addEventListener('click', () => pick(c));
      list.appendChild(b);
    });
    $('.js-add').classList.toggle('hidden', !q.trim() || !!findCategory(q));
  };
  $('.js-q').addEventListener('input', render);
  $('.js-back').addEventListener('click', () => closeScreen());
  $('.js-add').addEventListener('click', () => {
    const name = $('.js-q').value.trim();
    if (addCategory(name)) pick(name); else showToast('Категория уже существует');
  });
  render();
  openScreen(el);
}
