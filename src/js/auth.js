// auth.js
// Autenticação via API (/api/login) e controle do painel admin

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem('arcade365_session')) || null;
  } catch (e) { return null; }
}

function saveSession(session, token) {
  sessionStorage.setItem('arcade365_session', JSON.stringify(session));
  if (token) sessionStorage.setItem('arcade365_token', token);
}

function clearSession() {
  sessionStorage.removeItem('arcade365_session');
  sessionStorage.removeItem('arcade365_token');
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) { const err = await res.json().catch(()=>({})); alert(err.error || 'Credenciais inválidas'); return; }
    const body = await res.json();
    saveSession(body.user, body.token);
    updateAuthUI();
  } catch (e) {
    console.error(e);
    alert('Erro ao tentar logar');
  }
}

function handleLogout() {
  // call server to remove refresh token cookie
  fetch('/api/logout', { method: 'POST', credentials: 'include' }).finally(() => {
    clearSession();
    updateAuthUI();
  });
}

function updateAuthUI() {
  const session = getSession();
  const loginBox = document.getElementById('login-box');
  const userBox = document.getElementById('user-box');
  const adminPanel = document.getElementById('admin-panel');

  if (session) {
    if (loginBox) loginBox.style.display = 'none';
    if (userBox) { userBox.style.display = 'flex'; userBox.querySelector('#user-name').textContent = session.displayName || session.username; }
    if (adminPanel) adminPanel.style.display = (session.role === 'admin') ? 'block' : 'none';
  } else {
    if (loginBox) loginBox.style.display = 'block';
    if (userBox) userBox.style.display = 'none';
    if (adminPanel) adminPanel.style.display = 'none';
  }
}

async function handleAddGame(e) {
  e.preventDefault();
  const session = getSession();
  const token = sessionStorage.getItem('arcade365_token');
  if (!session || session.role !== 'admin' || !token) {
    alert('Somente administrador pode adicionar jogos.');
    return;
  }

  const name = document.getElementById('new-game-name').value.trim();
  const link = document.getElementById('new-game-link').value.trim();
  const img = document.getElementById('new-game-img').value.trim() || './assets/img/example.png';
  const subtitle = document.getElementById('new-game-subtitle').value.trim() || '';
  if (!name) { alert('Nome é obrigatório'); return; }

  const entry = { name, link, img, subtitle };

  try {
    const res = await fetch('/api/upcomingGames', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(entry)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Falha ao adicionar jogo');
      return;
    }
    const body = await res.json();
    if (typeof window.addGames === 'function') window.addGames();
    alert('Jogo adicionado com sucesso.');
  } catch (e) {
    console.error(e);
    alert('Erro ao adicionar jogo');
  }
}

async function handleDownloadJSON(e) {
  e.preventDefault();
  try {
    const res = await fetch('/api/upcomingGames');
    if (!res.ok) { alert('Não foi possível baixar o JSON'); return; }
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'upcomingGames.json';
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert('Erro ao baixar JSON');
  }
}

document.addEventListener('DOMContentLoaded', function(){
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('logout-btn');
  const addGameForm = document.getElementById('add-game-form');
  const downloadBtn = document.getElementById('download-games');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  if (addGameForm) addGameForm.addEventListener('submit', handleAddGame);
  if (downloadBtn) downloadBtn.addEventListener('click', handleDownloadJSON);

  // Try to refresh session using httpOnly cookie
  (async function tryRefresh(){
    try {
      const r = await fetch('/api/refresh', { method: 'POST', credentials: 'include' });
      if (!r.ok) { updateAuthUI(); return; }
      const body = await r.json();
      saveSession(body.user, body.token);
      updateAuthUI();
    } catch (e) {
      updateAuthUI();
    }
  })();
});
