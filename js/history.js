/* =============================================
   HISTORY.JS — экран «История» (как в Depoza)
   Шапка: поиск, итог, период «Начало / Окончание», вид Категории⇄Записи, фильтр, меню ⋮.
   Тап по категории → записи этой категории + плашка «СБРОСИТЬ».
     «СБРОСИТЬ» снимает фильтр категории и оставляет текущий вид.
     Системная «Назад» снимает фильтр и возвращает к списку категорий.
   Свайп влево/вправо по списку — следующий/предыдущий период.
   ============================================= */

const hist = {
  filter: {
    period: { type: 'custom', from: null, to: null },
    categories: null,
    search: '',
    mode: 'categories'
  },
  catLayer: false // фильтр поставлен тапом по категории (тогда «Назад» его снимает)
};

function renderHistory() {
  const f = hist.filter;
  const expenses = queryExpenses(f);

  document.getElementById('history-total').innerHTML = formatAmountHTML(sumTotal(expenses));
  const pl = periodBoundsLabel(f.period);
  document.getElementById('hp-from').textContent = pl.from;
  document.getElementById('hp-to').textContent = pl.to;

  const toggle = document.getElementById('btn-view-toggle');
  toggle.innerHTML = f.mode === 'categories' ? ICONS.list : ICONS.grid;
  toggle.setAttribute('aria-label', f.mode === 'categories' ? 'Показать записи' : 'Показать категории');

  const search = document.getElementById('history-search');
  if (search.value !== (f.search || '')) search.value = f.search || '';

  const list = document.getElementById('history-list');
  list.innerHTML = '';

  if (!expenses.length) {
    list.innerHTML = '<div class="history-empty">Нет записей</div>';
  } else if (f.mode === 'categories') {
    sumByCategory(expenses).forEach(({ category, amount }) => {
      const row = document.createElement('button');
      row.className = 'history-row history-cat-row';
      row.innerHTML = `
        <span class="history-cat-name">${escapeHTML(category)}</span>
        <span class="history-amount">${formatAmountHTML(amount)}</span>
      `;
      row.addEventListener('click', () => onHistoryCategoryTap(category));
      list.appendChild(row);
    });
  } else {
    expenses.forEach(e => {
      const row = document.createElement('button');
      row.className = 'history-row history-entry';
      row.innerHTML = `
        <span class="history-entry-main">
          <span class="history-entry-title">${escapeHTML(e.note || e.category)}</span>
          <span class="history-entry-cat">#${escapeHTML(e.category)}</span>
        </span>
        <span class="history-entry-side">
          <span class="history-amount">${formatAmountHTML(e.amount)}</span>
          <span class="history-entry-when">${formatEntryWhen(e)}</span>
        </span>
      `;
      row.addEventListener('click', () => openExpenseEditor(e, () => { renderHistory(); }));
      list.appendChild(row);
    });
  }

  renderHistorySnackbar();
}

function renderHistorySnackbar() {
  const bar = document.getElementById('history-snackbar');
  const cats = hist.filter.categories;
  if (!cats || !cats.length) { bar.classList.add('hidden'); return; }
  bar.querySelector('.snackbar-text').textContent =
    cats.length === 1 ? cats[0] : 'Выбрано несколько категорий';
  bar.classList.remove('hidden');
}

function onHistoryCategoryTap(category) {
  hist.filter.categories = [category];
  hist.filter.mode = 'entries';
  if (!hist.catLayer) {
    hist.catLayer = true;
    pushLayer(() => {
      // системная «Назад»: снять фильтр и вернуться к категориям
      hist.catLayer = false;
      hist.filter.categories = null;
      hist.filter.mode = 'categories';
      renderHistory();
    });
  }
  document.getElementById('history-list').scrollTop = 0;
  document.getElementById('tab-history').scrollTop = 0;
  renderHistory();
}

function resetHistoryCategories() {
  hist.filter.categories = null;
  if (hist.catLayer) {
    hist.catLayer = false;
    popLayer(false); // убрать запись «Назад», вид не меняем
  }
  renderHistory();
}

// Открыть Историю с готовым фильтром (из отчёта)
function setHistoryFilter(filter) {
  if (hist.catLayer) { hist.catLayer = false; popLayer(false); }
  hist.filter = filter;
  renderHistory();
}

function _setHistoryBound(which) {
  const b = periodBounds(hist.filter.period);
  pickDate(b[which] || getTodayStr(), d => {
    let from = which === 'from' ? d : b.from;
    let to = which === 'to' ? d : b.to;
    if (from && to && from > to) [from, to] = [to, from];
    hist.filter.period = { type: 'custom', from, to };
    renderHistory();
  });
}

function _shiftHistoryPeriod(dir) {
  const next = shiftPeriod(hist.filter.period, dir);
  if (next === hist.filter.period) return;
  hist.filter.period = next;
  const list = document.getElementById('history-list');
  list.classList.remove('slide-left', 'slide-right');
  void list.offsetWidth;
  list.classList.add(dir > 0 ? 'slide-left' : 'slide-right');
  renderHistory();
}

function openDataMenu() {
  const actions = [];
  if (cloudIsConfigured()) {
    if (!cloudIsConnected()) {
      actions.push({ label: 'Подключить Dropbox', hint: 'Автокопия после каждого изменения; если копия уже есть — данные восстановятся', run: cloudConnect });
    } else {
      const s = cloudStatus();
      actions.push({
        label: s.lastError ? 'Dropbox: копия не дошла' : 'Dropbox: подключён',
        hint: s.lastError
          ? `${s.lastError}. Нажмите, чтобы повторить`
          : `Последняя копия: ${_formatBackupTime(s.lastBackupAt)}. Нажмите, чтобы отправить сейчас`,
        run: cloudBackupNow
      });
      actions.push({
        label: 'Отключить Dropbox', hint: 'Копия в Dropbox останется',
        run: () => { if (confirm('Отключить автоматическую копию в Dropbox?')) cloudDisconnect(); }
      });
    }
  }
  actions.push(
    { label: 'Категории', hint: 'Переименовать, удалить, добавить', run: openCategoriesScreen },
    { label: 'Экспорт в CSV', hint: 'Для Excel: дата, категория, сумма, описание', run: exportToCSV },
    { label: 'Сохранить бэкап (JSON)', hint: 'Все записи, категории и отчёты одним файлом', run: exportBackupJSON },
    { label: 'Загрузить из файла', hint: 'Бэкап My Finance или экспорт из Depoza. Дубли пропускаются', run: () => document.getElementById('import-file-input').click() },
    { label: `Версия ${APP_VERSION}`, info: true }
  );
  openActionMenu('Данные', actions);
}

function _formatBackupTime(ts) {
  if (!ts) return 'ещё не было';
  const d = new Date(ts);
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const date = _isoDate(d) === getTodayStr() ? 'сегодня' : formatShortDate(_isoDate(d));
  return `${date} в ${time}`;
}

function initHistoryScreen() {
  document.getElementById('history-search').addEventListener('input', e => {
    hist.filter.search = e.target.value;
    renderHistory();
  });
  document.getElementById('hp-from').addEventListener('click', () => _setHistoryBound('from'));
  document.getElementById('hp-to').addEventListener('click', () => _setHistoryBound('to'));
  document.getElementById('btn-view-toggle').addEventListener('click', () => {
    hist.filter.mode = hist.filter.mode === 'categories' ? 'entries' : 'categories';
    renderHistory();
  });
  document.getElementById('btn-filter').addEventListener('click', () => {
    openFilterEditor({
      kind: 'history',
      filter: hist.filter,
      onApply: f => setHistoryFilter(f)
    });
  });
  document.getElementById('btn-data-menu').addEventListener('click', openDataMenu);
  document.querySelector('#history-snackbar .snackbar-action').addEventListener('click', resetHistoryCategories);

  // Свайп по списку — соседний период
  const list = document.getElementById('history-list');
  let sx = 0, sy = 0, tracking = false;
  list.addEventListener('touchstart', e => {
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; tracking = true;
  }, { passive: true });
  list.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) _shiftHistoryPeriod(dx < 0 ? 1 : -1);
  }, { passive: true });
}
