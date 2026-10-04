/* =============================================
   APP.JS — навигация по вкладкам и запуск
   Экраны: expenses.js (Расходы), dashboards.js (Отчёты), history.js (История)
   ============================================= */

// Версия приложения — менять вместе с новой записью в CHANGELOG.md
const APP_VERSION = '2.0.1';

let activeTab = 'expenses';

function switchTab(tabId) {
  if (tabId !== activeTab) clearLayers();
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tabId}"]`).classList.add('active');
  activeTab = tabId;

  if (tabId === 'reports') renderReports();
  if (tabId === 'history') renderHistory();
  if (tabId === 'expenses') renderExpenseForm();
}

function refreshAllScreens() {
  renderExpenseForm();
  renderReports();
  renderHistory();
}

document.addEventListener('DOMContentLoaded', () => {
  initData();

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  initExpensesScreen();
  initHistoryScreen();
  document.getElementById('btn-new-report').addEventListener('click', createReport);

  // Импорт из файла (меню ⋮ в Истории)
  document.getElementById('import-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    importFromFile(file)
      .then(({ added, skipped, newCategories, replacedCategories }) => {
        alert(
          `Импорт завершён.\n` +
          `Добавлено записей: ${added}\n` +
          (skipped ? `Пропущено (уже были): ${skipped}\n` : '') +
          (replacedCategories
            ? `Категории взяты из файла: ${newCategories} (стандартные убраны)`
            : `Новых категорий: ${newCategories}`)
        );
        refreshAllScreens();
      })
      .catch(err => alert('Не удалось импортировать файл: ' + err.message));
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // Автокопия в Dropbox (в т.ч. обработка возврата после входа в Dropbox)
  cloudInit();

  renderReports();
  renderHistory();
});
