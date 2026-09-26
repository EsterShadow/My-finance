/* =============================================
   DASHBOARDS.JS — экран «Отчёты» (как в Depoza)
   Карточки трёх видов: только сумма / последние 5 записей / топ-3 категории.
   📌 — закрепить (только один отчёт; показывается сверху с графиком).
   ⋮  — Редактировать / Удалить.
   Тап по карточке — История с фильтром этого отчёта.
   ============================================= */

function renderReports() {
  const pinnedBox = document.getElementById('reports-pinned');
  const list = document.getElementById('reports-list');
  pinnedBox.innerHTML = '';
  list.innerHTML = '';
  getReports().forEach(r => {
    if (r.pinned) pinnedBox.appendChild(buildPinnedCard(r));
    else list.appendChild(buildReportCard(r));
  });
}

function _reportCardHead(r, total, pinned) {
  const head = document.createElement('div');
  head.className = 'report-card-top';
  head.innerHTML = `
    <div class="report-card-titles">
      ${total > 0 ? `<div class="report-total">${formatAmountHTML(total)}</div>` : ''}
      <div class="report-name">${escapeHTML(r.name)}</div>
    </div>
    <div class="report-card-icons">
      <button class="icon-btn js-pin${pinned ? ' active' : ''}" aria-label="${pinned ? 'Открепить' : 'Закрепить'}">${pinned ? ICONS.pinFilled : ICONS.pin}</button>
      <button class="icon-btn js-more" aria-label="Меню отчёта">${ICONS.more}</button>
    </div>
  `;
  head.querySelector('.js-pin').addEventListener('click', ev => {
    ev.stopPropagation();
    togglePinReport(r.id);
    renderReports();
  });
  head.querySelector('.js-more').addEventListener('click', ev => {
    ev.stopPropagation();
    openActionMenu(r.name, [
      { label: 'Редактировать', run: () => editReport(r) },
      { label: 'Удалить', danger: true, run: () => {
        if (confirm(`Удалить отчёт «${r.name}»?`)) { deleteReport(r.id); renderReports(); }
      } }
    ]);
  });
  return head;
}

function buildReportCard(r) {
  const expenses = queryExpenses(r.filter);
  const total = sumTotal(expenses);
  const card = document.createElement('div');
  card.className = 'report-card';
  card.appendChild(_reportCardHead(r, total, false));

  const body = document.createElement('div');
  if (total <= 0) {
    body.className = 'report-empty-note';
    body.textContent = 'Не обнаружено записей';
  } else if (r.filter.mode === 'entries') {
    body.className = 'report-rows';
    expenses.slice(0, 5).forEach(e => {
      const row = document.createElement('div');
      row.className = 'report-row';
      row.innerHTML = `
        <span class="report-row-label">${escapeHTML(e.note || e.category)}</span>
        <span class="report-row-amount">${formatAmountHTML(e.amount)}</span>
      `;
      body.appendChild(row);
    });
  } else if (r.filter.mode === 'categories') {
    body.className = 'report-top3';
    sumByCategory(expenses).slice(0, 3).forEach(({ category, amount }) => {
      const item = document.createElement('div');
      item.className = 'report-top3-item';
      item.innerHTML = `
        <span class="report-top3-amount">${formatAmountHTML(amount)}</span>
        <span class="report-top3-label">${escapeHTML(category)}</span>
      `;
      body.appendChild(item);
    });
  }
  card.appendChild(body);
  card.addEventListener('click', () => openHistoryFromReport(r));
  return card;
}

function buildPinnedCard(r) {
  const expenses = queryExpenses(r.filter);
  const total = sumTotal(expenses);
  const card = document.createElement('div');
  card.className = 'report-card pinned';
  card.appendChild(_reportCardHead(r, total, true));

  const b = periodBounds(r.filter.period);
  const dates = expenses.map(e => e.date).sort();
  const from = b.from || dates[0];
  const to = b.to || dates[dates.length - 1];
  if (from && to) {
    const p = document.createElement('div');
    p.className = 'report-period-label';
    p.textContent = `${formatDotDate(from)} - ${formatDotDate(to)}`;
    card.appendChild(p);
  }
  if (total > 0 && from && to) {
    card.appendChild(buildChart(expenses, from, to));
  } else {
    const e = document.createElement('div');
    e.className = 'report-empty-note';
    e.textContent = 'Не обнаружено записей';
    card.appendChild(e);
  }
  card.addEventListener('click', () => openHistoryFromReport(r));
  return card;
}

// Линейный график: по часам (1 день), по дням (до ~2 месяцев), по месяцам (дольше)
function buildChart(expenses, from, to) {
  const days = Math.round((_parseISO(to) - _parseISO(from)) / 86400000) + 1;
  let buckets = [];
  let keyOf;
  if (days === 1) {
    for (let h = 0; h < 24; h++) buckets.push({ key: h, label: `${h}:00` });
    keyOf = e => e.ts ? new Date(e.ts).getHours() : 12;
  } else if (days <= 62) {
    for (let i = 0; i < days; i++) {
      const d = _addDays(from, i);
      buckets.push({ key: d, label: formatShortDate(d) });
    }
    keyOf = e => e.date;
  } else {
    const start = _parseISO(from), end = _parseISO(to);
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({ key: k, label: `${MONTHS_SHORT[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}` });
      cur.setMonth(cur.getMonth() + 1);
    }
    keyOf = e => e.date.slice(0, 7);
  }
  const sums = new Map(buckets.map(b => [b.key, 0]));
  expenses.forEach(e => { const k = keyOf(e); if (sums.has(k)) sums.set(k, sums.get(k) + e.amount); });
  const values = buckets.map(b => sums.get(b.key));
  const max = Math.max(...values, 1);

  const W = 320, H = 120, PAD = 6;
  const step = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [PAD + i * step, H - PAD - (v / max) * (H - PAD * 2)]);
  const line = pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ');
  const area = `${PAD},${H - PAD} ${line} ${(PAD + (values.length - 1) * step).toFixed(1)},${H - PAD}`;
  const iMax = values.indexOf(Math.max(...values));

  const wrap = document.createElement('div');
  wrap.className = 'chart';
  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="${area}" class="chart-area"/>
      <polyline points="${line}" class="chart-line" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="chart-axis">
      <span>${escapeHTML(buckets[0].label)}</span>
      <span class="chart-max">макс. ${formatAmount(values[iMax])} — ${escapeHTML(buckets[iMax].label)}</span>
      <span>${escapeHTML(buckets[buckets.length - 1].label)}</span>
    </div>
  `;
  return wrap;
}

function editReport(r) {
  openFilterEditor({
    kind: 'report',
    name: r.name,
    filter: r.filter,
    onApply: (filter, name) => {
      saveReport({ ...r, name, filter });
      renderReports();
    }
  });
}

function createReport() {
  openFilterEditor({
    kind: 'report',
    name: '',
    filter: { period: { type: 'month', offset: 0 }, categories: null, search: '', mode: 'categories' },
    onApply: (filter, name) => {
      saveReport({ name, pinned: false, filter });
      renderReports();
    }
  });
}

function openHistoryFromReport(r) {
  const f = JSON.parse(JSON.stringify(r.filter));
  if (f.mode === 'none') f.mode = 'categories';
  switchTab('history');
  setHistoryFilter(f);
}
