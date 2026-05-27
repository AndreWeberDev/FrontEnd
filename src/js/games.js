// games.js
// Busca `upcomingGames` de um JSON e renderiza os blocos.
let _upcomingGames = [];

async function fetchUpcomingGames() {
  try {
    // Primeiro tenta carregar da API (quando o servidor estiver rodando)
    const res = await fetch('/api/upcomingGames', { cache: 'no-store' });
    if (res.ok) return await res.json();

    // Fallback para arquivo local
    const local = await fetch('./src/data/upcomingGames.json', { cache: 'no-store' });
    if (local.ok) return await local.json();
    return [];
  } catch (e) {
    console.error('Falha ao carregar upcomingGames.json', e);
    return [];
  }
}

function renderGames(list) {
  const container = document.getElementById('dynamic-games');
  if (!container) return;
  container.innerHTML = '';

  list.forEach((g, idx) => {
    const isLink = g.link && g.link.trim() !== '';

    if (isLink) {
      const a = document.createElement('a');
      a.href = g.link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      const inner = document.createElement('div');
      inner.className = 'jogo';
      inner.classList.add(idx % 2 === 0 ? 'path-left' : 'path-right');

      const img = document.createElement('img');
      img.src = g.img || './assets/img/example.png';
      img.alt = g.name || '';
      img.width = 120; img.height = 120;

      const title = document.createElement('div');
      title.textContent = g.name || 'Em Breve';
      title.style.marginTop = '10px';
      title.style.fontWeight = '700';

      const subtitle = document.createElement('div');
      subtitle.className = 'jogo-breve-subtitle';
      subtitle.textContent = g.subtitle || '';

      inner.appendChild(img);
      inner.appendChild(title);
      inner.appendChild(subtitle);
      a.appendChild(inner);
      container.appendChild(a);
    } else {
      const div = document.createElement('div');
      div.className = 'jogo-breve';
      div.classList.add(idx % 2 === 0 ? 'path-left' : 'path-right');

      const icon = document.createElement('div');
      icon.className = 'jogo-breve-text';
      icon.textContent = '🎮';

      const title = document.createElement('div');
      title.className = 'jogo-breve-text';
      title.textContent = g.name || 'Em Breve';

      const subtitle = document.createElement('div');
      subtitle.className = 'jogo-breve-subtitle';
      subtitle.textContent = g.subtitle || '';

      div.appendChild(icon);
      div.appendChild(title);
      div.appendChild(subtitle);
      container.appendChild(div);
    }
  });
}

async function addGames() {
  _upcomingGames = await fetchUpcomingGames();
  renderGames(_upcomingGames);
}

function addGameEntry(entry) {
  _upcomingGames.push(entry);
  renderGames(_upcomingGames);
}

function downloadUpdatedGames() {
  const dataStr = JSON.stringify(_upcomingGames, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'upcomingGames.json';
  a.click();
  URL.revokeObjectURL(url);
}

window.addGames = addGames;
window.addGameEntry = addGameEntry;
window.downloadUpdatedGames = downloadUpdatedGames;

document.addEventListener('DOMContentLoaded', function(){
  addGames();
});
