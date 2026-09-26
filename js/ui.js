/* =============================================
   UI.JS — общие элементы интерфейса
   - слои (экраны поверх, диалоги) + системная кнопка «Назад»
   - тост, плашка (snackbar), меню действий, выбор даты
   ============================================= */

// ---- Слои и кнопка «Назад» ----
// Каждый открытый экран/диалог кладёт в историю браузера запись.
// Системная «Назад» (Android) закрывает верхний слой, а не приложение.

// Обработчики слоёв выполняются сразу, а переходы по истории браузера
// асинхронны. Поэтому новые записи истории (pushState) откладываются,
// пока не отработают наши собственные history.back(), — иначе стек собьётся.

const _layers = [];
let _skipPops = 0;        // сколько popstate ожидается от наших же history.back()/go()
const _afterIdle = [];    // отложенные pushState

function _whenIdle(fn) {
  if (_skipPops === 0) fn(); else _afterIdle.push(fn);
}

function pushLayer(onBack) {
  _layers.push(onBack);
  _whenIdle(() => history.pushState({ layer: true }, ''));
}

// Закрыть верхний слой из интерфейса (крестик, «Применить» и т.п.)
// runHandler=false — только убрать запись «Назад», обработчик не вызывать
function popLayer(runHandler = true) {
  if (!_layers.length) return;
  const handler = _layers.pop();
  _skipPops++;
  history.back();
  if (runHandler && handler) handler();
}

// Закрыть все слои (например, при смене вкладки)
function clearLayers() {
  const n = _layers.length;
  if (!n) return;
  const handlers = _layers.splice(0, n).reverse();
  _skipPops++;
  history.go(-n);
  handlers.forEach(h => h && h());
}

window.addEventListener('popstate', () => {
  if (_skipPops > 0) {
    _skipPops--;
    if (_skipPops === 0) _afterIdle.splice(0).forEach(fn => fn());
    return;
  }
  // системная «Назад»
  const handler = _layers.pop();
  if (handler) handler();
});

// ---- Полноэкранный экран поверх приложения ----

function openScreen(el, onClose) {
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('open'));
  pushLayer(() => {
    el.remove();
    if (onClose) onClose();
  });
}

function closeScreen() { popLayer(true); }

// ---- Модальный диалог по центру ----

function openDialog(contentEl, { onClose } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.appendChild(contentEl);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) popLayer(true); });
  document.body.appendChild(backdrop);
  pushLayer(() => {
    backdrop.remove();
    if (onClose) onClose();
  });
}

// Меню действий: [{ label, run, hint?, danger? } | { label, info: true }]
function openActionMenu(title, actions) {
  const box = document.createElement('div');
  box.className = 'dialog action-menu';
  if (title) {
    const h = document.createElement('div');
    h.className = 'dialog-title';
    h.textContent = title;
    box.appendChild(h);
  }
  let chosen = null;
  actions.forEach(a => {
    if (a.info) { // неактивная строка-подпись (например, версия)
      const d = document.createElement('div');
      d.className = 'action-menu-info';
      d.textContent = a.label;
      box.appendChild(d);
      return;
    }
    const b = document.createElement('button');
    b.className = 'action-menu-item' + (a.danger ? ' danger' : '');
    b.innerHTML = a.hint
      ? `${escapeHTML(a.label)}<small>${escapeHTML(a.hint)}</small>`
      : escapeHTML(a.label);
    b.addEventListener('click', () => {
      // действие выполняется при закрытии меню
      chosen = a.run;
      popLayer(true);
    });
    box.appendChild(b);
  });
  openDialog(box, { onClose: () => { if (chosen) chosen(); } });
}

// ---- Тост ----

let _toastTimer = null;
function showToast(text) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.add('visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('visible'), 2200);
}

// ---- Выбор даты (системный календарь) ----

function pickDate(initialISO, onPick) {
  const input = document.createElement('input');
  input.type = 'date';
  input.className = 'date-input-hidden';
  input.value = initialISO || getTodayStr();
  document.body.appendChild(input);
  let done = false;
  input.addEventListener('change', () => {
    if (done) return;
    done = true;
    if (input.value) onPick(input.value);
    input.remove();
  });
  input.addEventListener('blur', () => setTimeout(() => { if (!done) input.remove(); }, 500));
  try { input.showPicker(); } catch { input.click(); }
}

// ---- Иконки (SVG) ----

const ICONS = {
  back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  close: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  pin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M9 3h6l-1 6 4 4H6l4-4-1-6z"/><path d="M12 13v8"/></svg>',
  pinFilled: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M9 3h6l-1 6 4 4H6l4-4-1-6z"/><path d="M12 13v8" fill="none"/></svg>',
  more: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
  list: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="4" height="4" rx="0.5"/><rect x="9" y="5" width="12" height="2" rx="1"/><rect x="3" y="10" width="4" height="4" rx="0.5"/><rect x="9" y="11" width="12" height="2" rx="1"/><rect x="3" y="16" width="4" height="4" rx="0.5"/><rect x="9" y="17" width="12" height="2" rx="1"/></svg>',
  grid: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="5" height="4" rx="0.5"/><rect x="9.5" y="4" width="5" height="4" rx="0.5"/><rect x="16" y="4" width="5" height="4" rx="0.5"/><rect x="3" y="10" width="5" height="4" rx="0.5"/><rect x="9.5" y="10" width="5" height="4" rx="0.5"/><rect x="16" y="10" width="5" height="4" rx="0.5"/><rect x="3" y="16" width="5" height="4" rx="0.5"/><rect x="9.5" y="16" width="5" height="4" rx="0.5"/><rect x="16" y="16" width="5" height="4" rx="0.5"/></svg>',
  tune: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>'
};
