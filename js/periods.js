/* =============================================
   PERIODS.JS — периоды как в Depoza
   Период хранится как правило и пересчитывается от сегодняшней даты:
     { type: 'day'|'week'|'month'|'year', offset }   — календарные (offset: 0 текущий, -1 прошлый)
     { type: 'last7'|'last30', offset }              — последние N дней, ВКЛЮЧАЯ сегодня
     { type: 'custom', from, to }                    — даты 'YYYY-MM-DD' или null (без ограничения)
   Все границы — даты включительно.
   ============================================= */

const MONTHS_SHORT = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];

function _isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function _parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function _addDays(iso, n) {
  const d = _parseISO(iso);
  d.setDate(d.getDate() + n);
  return _isoDate(d);
}

function getTodayStr() { return _isoDate(new Date()); }
function getYesterdayStr() { return _addDays(getTodayStr(), -1); }

// { from, to } — строки или null
function periodBounds(p) {
  const today = new Date();
  const off = p.offset || 0;
  switch (p.type) {
    case 'day': {
      const d = _addDays(_isoDate(today), off);
      return { from: d, to: d };
    }
    case 'week': {
      const dow = (today.getDay() + 6) % 7; // понедельник = 0
      const from = _addDays(_isoDate(today), -dow + off * 7);
      return { from, to: _addDays(from, 6) };
    }
    case 'month': {
      const f = new Date(today.getFullYear(), today.getMonth() + off, 1);
      const t = new Date(today.getFullYear(), today.getMonth() + off + 1, 0);
      return { from: _isoDate(f), to: _isoDate(t) };
    }
    case 'year': {
      const y = today.getFullYear() + off;
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    case 'last7':
    case 'last30': {
      const n = p.type === 'last7' ? 7 : 30;
      const to = _addDays(_isoDate(today), off * n);
      return { from: _addDays(to, -(n - 1)), to };
    }
    case 'custom':
    default:
      return { from: p.from || null, to: p.to || null };
  }
}

// Соседний период (свайп в Истории): dir = -1 назад, +1 вперёд
function shiftPeriod(p, dir) {
  if (p.type === 'custom') {
    if (!p.from || !p.to) return p; // без границ сдвигать нечего
    const len = Math.round((_parseISO(p.to) - _parseISO(p.from)) / 86400000) + 1;
    return { type: 'custom', from: _addDays(p.from, dir * len), to: _addDays(p.to, dir * len) };
  }
  return { ...p, offset: (p.offset || 0) + dir };
}

// Готовые варианты для экрана «Фильтр» / «Новый отчёт»
const PERIOD_GROUPS = [
  { id: 'day', label: 'День', items: [
    { label: 'Сегодня', period: { type: 'day', offset: 0 } },
    { label: 'Вчера', period: { type: 'day', offset: -1 } }
  ]},
  { id: 'week', label: 'Неделя', items: [
    { label: 'Последние 7 дней', period: { type: 'last7', offset: 0 } },
    { label: 'Текущая неделя', period: { type: 'week', offset: 0 } },
    { label: 'Прошлая неделя', period: { type: 'week', offset: -1 } }
  ]},
  { id: 'month', label: 'Месяц', items: [
    { label: 'Последние 30 дней', period: { type: 'last30', offset: 0 } },
    { label: 'Текущий месяц', period: { type: 'month', offset: 0 } },
    { label: 'Прошлый месяц', period: { type: 'month', offset: -1 } }
  ]},
  { id: 'year', label: 'Год', items: [
    { label: 'Текущий год', period: { type: 'year', offset: 0 } },
    { label: 'Прошлый год', period: { type: 'year', offset: -1 } }
  ]},
  { id: 'custom', label: 'Другой период', items: [] }
];

function samePeriod(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'custom') return (a.from || null) === (b.from || null) && (a.to || null) === (b.to || null);
  return (a.offset || 0) === (b.offset || 0);
}

function periodGroupId(p) {
  if (p.type === 'last7') return 'week';
  if (p.type === 'last30') return 'month';
  return p.type;
}

// «1 сент.» / «24 нояб. '25»
function formatShortDate(iso) {
  const d = _parseISO(iso);
  const y = d.getFullYear() !== new Date().getFullYear() ? ` '${String(d.getFullYear()).slice(2)}` : '';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${y}`;
}

// Подпись в шапке Истории: «1 сент. / 30 сент.», «Начало / Окончание»
function periodBoundsLabel(p) {
  const b = periodBounds(p);
  return {
    from: b.from ? formatShortDate(b.from) : 'Начало',
    to: b.to ? formatShortDate(b.to) : 'Окончание'
  };
}

// «26.09.26»
function formatDotDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}
