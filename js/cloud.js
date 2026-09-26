/* =============================================
   CLOUD.JS — автоматическая копия в Dropbox
   Как в Depoza: после каждого изменения данных копия уходит в Dropbox.

   - Вход через OAuth 2 PKCE прямо из браузера, без сервера и без секретов.
     App key не секретный: его видно любому, но войти через него можно только
     со страниц, перечисленных в Redirect URIs в настройках Dropbox-приложения.
   - Файлы лежат в папке приложения: Dropbox / Приложения / <имя приложения>/
       myfinance_backup.json          — актуальная копия (перезаписывается)
       history/myfinance_YYYY-MM-DD.json — снимок на каждый день (страховка
                                           от случайного удаления)
   - Токены хранятся отдельно от данных (ключ myfinance_dropbox) и в бэкап
     не попадают.
   ============================================= */

const DROPBOX_APP_KEY = ''; // ← вставить App key из dropbox.com/developers/apps

const CLOUD_KEY = 'myfinance_dropbox';
const CLOUD_FILE = '/myfinance_backup.json';
const CLOUD_DEBOUNCE_MS = 2000;

let _cloudTimer = null;
let _cloudUploading = false;
let _cloudRestoring = false;

// ---- состояние ----

function _cloudState() {
  try { return JSON.parse(localStorage.getItem(CLOUD_KEY)) || {}; } catch { return {}; }
}
function _cloudSave(patch) {
  const s = { ..._cloudState(), ...patch };
  localStorage.setItem(CLOUD_KEY, JSON.stringify(s));
  cloudUpdateIndicator();
  return s;
}
function cloudIsConfigured() { return !!DROPBOX_APP_KEY; }
function cloudIsConnected() { return !!_cloudState().refreshToken; }
function cloudStatus() { return _cloudState(); }

function _redirectUri() {
  // https://estershadow.github.io/My-finance/ (без index.html)
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

// ---- PKCE ----

function _b64url(bytes) {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function cloudConnect() {
  if (!cloudIsConfigured()) {
    alert('Dropbox ещё не настроен: в js/cloud.js не указан App key.');
    return;
  }
  const verifier = _b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = _b64url(new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  ));
  localStorage.setItem(CLOUD_KEY + '_verifier', verifier);
  const params = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: _redirectUri(),
    token_access_type: 'offline'
  });
  location.href = 'https://www.dropbox.com/oauth2/authorize?' + params;
}

async function _tokenRequest(body) {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: DROPBOX_APP_KEY, ...body })
  });
  if (!res.ok) throw new Error('Dropbox: ошибка авторизации (' + res.status + ')');
  return res.json();
}

// Вызывается при загрузке страницы: если вернулись из Dropbox с ?code=...
async function cloudHandleRedirect() {
  const url = new URL(location.href);
  const code = url.searchParams.get('code');
  const verifier = localStorage.getItem(CLOUD_KEY + '_verifier');
  if (!code || !verifier) return false;

  // убираем code из адресной строки
  history.replaceState(null, '', _redirectUri());
  localStorage.removeItem(CLOUD_KEY + '_verifier');

  try {
    const t = await _tokenRequest({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: _redirectUri()
    });
    _cloudSave({
      refreshToken: t.refresh_token,
      accessToken: t.access_token,
      expiresAt: Date.now() + (t.expires_in - 60) * 1000,
      lastError: null
    });
    await _cloudFirstSync();
  } catch (e) {
    alert('Не удалось подключить Dropbox: ' + e.message);
  }
  return true;
}

async function _accessToken() {
  const s = _cloudState();
  if (!s.refreshToken) throw new Error('Dropbox не подключён');
  if (s.accessToken && s.expiresAt > Date.now()) return s.accessToken;
  const t = await _tokenRequest({ grant_type: 'refresh_token', refresh_token: s.refreshToken });
  _cloudSave({ accessToken: t.access_token, expiresAt: Date.now() + (t.expires_in - 60) * 1000 });
  return t.access_token;
}

function cloudDisconnect() {
  const s = _cloudState();
  if (s.accessToken) {
    // отзываем токен, ошибки не важны
    fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
      method: 'POST', headers: { Authorization: 'Bearer ' + s.accessToken }
    }).catch(() => {});
  }
  localStorage.removeItem(CLOUD_KEY);
  cloudUpdateIndicator();
}

// ---- файлы ----

async function _upload(path, text) {
  const token = await _accessToken();
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', mute: true })
    },
    body: text
  });
  if (!res.ok) throw new Error('загрузка ' + path + ': ' + res.status);
}

async function _download(path) {
  const token = await _accessToken();
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Dropbox-API-Arg': JSON.stringify({ path })
    }
  });
  if (res.status === 409) return null; // файла нет
  if (!res.ok) throw new Error('скачивание ' + path + ': ' + res.status);
  return res.text();
}

// ---- синхронизация ----

// Сразу после подключения: если в Dropbox уже есть копия — не затираем её.
// Пустое приложение → восстанавливаем из копии.
// Есть данные и там и там → объединяем (дубли по id пропускаются), потом выгружаем.
async function _cloudFirstSync() {
  const text = await _download(CLOUD_FILE);
  if (text) {
    const remote = JSON.parse(text);
    const remoteCount = (remote.expenses || []).length;
    _cloudRestoring = true;
    try {
      if (getExpenses().length === 0) {
        replaceAllData(remote);
        alert(`Dropbox подключён. Восстановлено записей: ${remoteCount}.`);
      } else {
        const r = importData(remote);
        alert(`Dropbox подключён. Копия объединена с данными телефона: добавлено ${r.added}, совпало ${r.skipped}.`);
      }
    } finally {
      _cloudRestoring = false;
    }
    if (typeof refreshAllScreens === 'function') refreshAllScreens();
  }
  await cloudBackupNow();
}

async function cloudBackupNow() {
  clearTimeout(_cloudTimer);
  if (!cloudIsConnected()) return;
  if (_cloudUploading) { _cloudSave({ pending: true }); return; }
  _cloudUploading = true;
  _cloudSave({ pending: false });
  try {
    const text = JSON.stringify(buildBackupObject());
    await _upload(CLOUD_FILE, text);
    await _upload('/history/myfinance_' + getTodayStr() + '.json', text);
    _cloudSave({ lastBackupAt: Date.now(), lastError: null });
  } catch (e) {
    _cloudSave({ pending: true, lastError: e.message });
  } finally {
    _cloudUploading = false;
    if (_cloudState().pending && !_cloudState().lastError) cloudScheduleBackup();
  }
}

// Вызывается из storage.js после каждого сохранения
function cloudScheduleBackup() {
  if (_cloudRestoring || !cloudIsConnected()) return;
  _cloudSave({ pending: true });
  clearTimeout(_cloudTimer);
  _cloudTimer = setTimeout(cloudBackupNow, CLOUD_DEBOUNCE_MS);
}

// Точка на кнопке ⋮, если копия не дошла
function cloudUpdateIndicator() {
  const btn = document.getElementById('btn-data-menu');
  if (!btn) return;
  const s = _cloudState();
  btn.classList.toggle('has-warning', !!(s.refreshToken && s.lastError));
}

function cloudInit() {
  cloudUpdateIndicator();
  // Приложение сворачивают — отправляем копию сразу, не дожидаясь таймера
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && _cloudState().pending) cloudBackupNow();
  });
  // Появилась сеть — досылаем то, что не ушло
  window.addEventListener('online', () => { if (_cloudState().pending) cloudBackupNow(); });
  cloudHandleRedirect().then(handled => {
    if (!handled && _cloudState().pending) cloudBackupNow();
  });
}
