/* =============================================
   CATEGORIES.JS — экран «Категории» (меню ⋮ в Истории)
   Список по алфавиту; тап — Переименовать / Удалить; внизу — новая категория.
   Удаление категории удаляет и её записи (как в Depoza), с предупреждением
   и числом записей.
   ============================================= */

function openCategoriesScreen() {
  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <div class="screen-header dark">
      <button class="icon-btn js-back" aria-label="Назад">${ICONS.back}</button>
      <span class="screen-title">Категории</span>
    </div>
    <div class="screen-body js-list"></div>
    <div class="new-category-row">
      <input class="field-input js-new" placeholder="Новая категория" autocomplete="off">
      <button class="btn-add-cat js-add" aria-label="Добавить">${ICONS.check}</button>
    </div>
  `;
  const $ = s => el.querySelector(s);

  const render = () => {
    const list = $('.js-list');
    list.innerHTML = '';
    categoriesAlphabetical().forEach(c => {
      const n = countExpensesInCategory(c);
      const b = document.createElement('button');
      b.className = 'category-item';
      b.innerHTML = `<span>${escapeHTML(c)}</span><span class="category-count">${n || ''}</span>`;
      b.addEventListener('click', () => openActionMenu(c, [
        { label: 'Переименовать', run: () => {
          const name = prompt('Новое название категории', c);
          if (name === null || name.trim() === c) return;
          if (!renameCategory(c, name)) showToast('Категория с таким названием уже есть');
          render();
          refreshAllScreens();
        } },
        { label: 'Удалить', danger: true, run: () => {
          const msg = n
            ? `Удалить категорию «${c}»?\n\nВнимание: ${n} ${_plural(n, 'запись', 'записи', 'записей')} в этой категории будут удалены навсегда.`
            : `Удалить категорию «${c}»?`;
          if (!confirm(msg)) return;
          deleteCategory(c);
          render();
          refreshAllScreens();
        } }
      ]));
      list.appendChild(b);
    });
  };

  const add = () => {
    const name = $('.js-new').value.trim();
    if (!name) { showToast('Введите название категории'); return; }
    if (!addCategory(name)) { showToast('Категория уже существует'); return; }
    $('.js-new').value = '';
    showToast('Новая категория успешно добавлена');
    render();
    refreshAllScreens();
  };
  $('.js-add').addEventListener('click', add);
  $('.js-new').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
  $('.js-back').addEventListener('click', () => closeScreen());

  render();
  openScreen(el);
}

function _plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
