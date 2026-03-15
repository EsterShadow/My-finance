/* =============================================
   EXPORT.JS — экспорт в CSV (Excel-совместимый)
   ============================================= */

function exportToCSV() {
  const expenses = getExpenses();

  if (expenses.length === 0) {
    alert('Нет данных для экспорта');
    return;
  }

  const sorted = [...expenses].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.id.localeCompare(a.id);
  });

  // UTF-8 BOM — чтобы Excel открывал с правильной кодировкой
  const BOM = '\uFEFF';
  const header = 'Дата;Категория;Сумма;Заметка';
  const rows = sorted.map(e => {
    const amount = e.amount.toFixed(2).replace('.', ',');
    // Экранируем кавычки в заметке
    const note = (e.note || '').replace(/"/g, '""');
    const noteFmt = note.includes(';') ? `"${note}"` : note;
    return `${e.date};${e.category};${amount};${noteFmt}`;
  });

  const csv = BOM + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `расходы_${getTodayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
