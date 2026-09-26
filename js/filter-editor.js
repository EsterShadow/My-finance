/* =============================================
   FILTER-EDITOR.JS — экран «Фильтр» (История) и «Новый отчёт / Настройки отчёта»
   Один экран на оба случая, как в Depoza:
   поиск, вкладки периода, отображение, категории (несколько).
   ============================================= */

const REPORT_MODES = [
  { id: 'none', label: 'Только сумма' },
  { id: 'entries', label: 'Последние 5 записей' },
  { id: 'categories', label: 'Топ-3 категории' }
];
const HISTORY_MODES = [
  { id: 'categories', label: 'Категории' },
  { id: 'entries', label: 'Записи' }
];

// opts: { kind: 'report'|'history', name?, filter, onApply(filter, name) }
function openFilterEditor(opts) {
  const f = JSON.parse(JSON.stringify(opts.filter));
  f.categories = f.categories ? [...f.categories] : [];
  let group = periodGroupId(f.period);
  let customFrom = null, customTo = null;
  {
    const b = periodBounds(f.period);
    customFrom = b.from; customTo = b.to;
  }

  const el = document.createElement('div');
  el.className = 'screen';
  el.innerHTML = `
    <div class="screen-header">
      <button class="icon-btn js-back" aria-label="Назад">${ICONS.back}</button>
      ${opts.kind === 'report'
        ? `<input class="screen-title-input js-name" placeholder="Название отчёта" value="${escapeHTML(opts.name || '')}">`
        : `<span class="screen-title">Фильтр</span>`}
      <button class="header-action js-apply">Применить</button>
    </div>
    <div class="screen-body">
      <label class="search-row">${ICONS.search}<input class="js-search" placeholder="Поиск" value="${escapeHTML(f.search || '')}"></label>
      <div class="period-tabs js-tabs"></div>
      <div class="js-period"></div>
      <div class="section-title">Отображение</div>
      <div class="js-modes"></div>
      <div class="section-title section-title-row">Категории <button class="link-btn js-clear-cats">Снять все</button></div>
      <div class="section-hint js-cats-hint"></div>
      <div class="js-cats"></div>
    </div>
  `;

  const $ = s => el.querySelector(s);

  function radio(name, label, checked, onChange) {
    const row = document.createElement('label');
    row.className = 'choice-row';
    row.innerHTML = `<input type="radio" name="${name}" ${checked ? 'checked' : ''}><span>${escapeHTML(label)}</span>`;
    row.querySelector('input').addEventListener('change', onChange);
    return row;
  }

  function renderTabs() {
    const tabs = $('.js-tabs');
    tabs.innerHTML = '';
    PERIOD_GROUPS.forEach(g => {
      const b = document.createElement('button');
      b.className = 'period-tab' + (g.id === group ? ' active' : '');
      b.textContent = g.label;
      b.addEventListener('click', () => {
        group = g.id;
        if (g.id === 'custom') {
          f.period = { type: 'custom', from: customFrom, to: customTo };
        } else if (!g.items.some(i => samePeriod(i.period, f.period))) {
          // по умолчанию — «текущий» вариант группы
          const cur = g.items.find(i => i.period.type === g.id && !(i.period.offset || 0)) || g.items[0];
          f.period = { ...cur.period };
        }
        renderTabs();
        renderPeriod();
        b.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      });
      tabs.appendChild(b);
    });
  }

  function renderPeriod() {
    const box = $('.js-period');
    box.innerHTML = '';
    const g = PERIOD_GROUPS.find(x => x.id === group);
    if (group !== 'custom') {
      g.items.forEach(item => {
        box.appendChild(radio('period', item.label, samePeriod(item.period, f.period), () => {
          f.period = { ...item.period };
        }));
      });
      return;
    }
    // Другой период: две даты, каждую можно оставить пустой (= без ограничения)
    [['from', 'Начало'], ['to', 'Окончание']].forEach(([key, label]) => {
      const row = document.createElement('div');
      row.className = 'date-row';
      const val = key === 'from' ? customFrom : customTo;
      row.innerHTML = `
        <span class="date-row-label">${label}</span>
        <button class="date-row-value">${val ? formatShortDate(val) : 'не задано'}</button>
        ${val ? `<button class="icon-btn small js-clear" aria-label="Очистить">${ICONS.close}</button>` : ''}
      `;
      row.querySelector('.date-row-value').addEventListener('click', () => {
        pickDate(val || getTodayStr(), d => {
          if (key === 'from') customFrom = d; else customTo = d;
          if (customFrom && customTo && customFrom > customTo) [customFrom, customTo] = [customTo, customFrom];
          f.period = { type: 'custom', from: customFrom, to: customTo };
          renderPeriod();
        });
      });
      const clr = row.querySelector('.js-clear');
      if (clr) clr.addEventListener('click', () => {
        if (key === 'from') customFrom = null; else customTo = null;
        f.period = { type: 'custom', from: customFrom, to: customTo };
        renderPeriod();
      });
      box.appendChild(row);
    });
  }

  function renderModes() {
    const box = $('.js-modes');
    box.innerHTML = '';
    const modes = opts.kind === 'report' ? REPORT_MODES : HISTORY_MODES;
    if (!modes.some(m => m.id === f.mode)) f.mode = modes[modes.length - 1].id;
    modes.forEach(m => box.appendChild(radio('mode', m.label, f.mode === m.id, () => { f.mode = m.id; })));
  }

  function renderCats() {
    const box = $('.js-cats');
    box.innerHTML = '';
    categoriesAlphabetical().forEach(c => {
      const row = document.createElement('label');
      row.className = 'choice-row';
      row.innerHTML = `<input type="checkbox" ${f.categories.includes(c) ? 'checked' : ''}><span>${escapeHTML(c)}</span>`;
      row.querySelector('input').addEventListener('change', e => {
        if (e.target.checked) f.categories.push(c);
        else f.categories = f.categories.filter(x => x !== c);
        updateCatsHint();
      });
      box.appendChild(row);
    });
    updateCatsHint();
  }

  function updateCatsHint() {
    $('.js-cats-hint').textContent = f.categories.length
      ? `Выбрано: ${f.categories.length}`
      : 'Не выбрано ни одной — учитываются все категории';
    $('.js-clear-cats').style.visibility = f.categories.length ? 'visible' : 'hidden';
  }

  $('.js-clear-cats').addEventListener('click', () => { f.categories = []; renderCats(); });
  $('.js-back').addEventListener('click', () => closeScreen());
  $('.js-apply').addEventListener('click', () => {
    let name = null;
    if (opts.kind === 'report') {
      name = $('.js-name').value.trim();
      if (!name) { showToast('Укажите название отчёта'); $('.js-name').focus(); return; }
    }
    f.search = $('.js-search').value.trim();
    const result = {
      period: f.period,
      categories: f.categories.length ? f.categories : null,
      search: f.search,
      mode: f.mode
    };
    closeScreen();
    opts.onApply(result, name);
  });

  renderTabs();
  renderPeriod();
  renderModes();
  renderCats();
  openScreen(el);
  if (opts.kind === 'report' && !opts.name) setTimeout(() => $('.js-name').focus(), 250);
}
