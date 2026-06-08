// games.js
// Busca `upcomingGames` de um JSON e renderiza os blocos.
let _upcomingGames = [];

const UPCOMING_IMAGE_SET = [
  './assets/img/gaming.webp',
  './assets/img/gaming2.webp',
  './assets/img/gaming3.webp'
];

function getUpcomingImage(index) {
  return UPCOMING_IMAGE_SET[index % UPCOMING_IMAGE_SET.length];
}

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
    const imageSrc = getUpcomingImage(idx);

    if (isLink) {
      const a = document.createElement('a');
      a.href = g.link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      const inner = document.createElement('article');
      inner.className = 'jogo jogo-em-breve';
      inner.classList.add(idx % 2 === 0 ? 'path-left' : 'path-right');

      const img = document.createElement('img');
      img.src = imageSrc;
      img.alt = g.name || 'Jogo em breve';
      img.width = 120;
      img.height = 120;

      const badge = document.createElement('span');
      badge.className = 'jogo-badge';
      badge.textContent = 'Em breve';

      const title = document.createElement('div');
      title.className = 'jogo-title';
      title.textContent = g.name || 'Em Breve';

      const subtitle = document.createElement('div');
      subtitle.className = 'jogo-breve-subtitle';
      subtitle.textContent = g.subtitle || 'Novo lançamento chegando ao Arcade365.';

      inner.appendChild(img);
      inner.appendChild(badge);
      inner.appendChild(title);
      inner.appendChild(subtitle);
      a.appendChild(inner);
      container.appendChild(a);
    } else {
      const div = document.createElement('article');
      div.className = 'jogo jogo-em-breve';
      div.classList.add(idx % 2 === 0 ? 'path-left' : 'path-right');

      const img = document.createElement('img');
      img.src = imageSrc;
      img.alt = g.name || 'Jogo em breve';
      img.width = 120;
      img.height = 120;

      const badge = document.createElement('span');
      badge.className = 'jogo-badge';
      badge.textContent = 'Em breve';

      const title = document.createElement('div');
      title.className = 'jogo-title';
      title.textContent = g.name || 'Em Breve';

      const subtitle = document.createElement('div');
      subtitle.className = 'jogo-breve-subtitle';
      subtitle.textContent = g.subtitle || 'Novo lançamento chegando ao Arcade365.';

      div.appendChild(img);
      div.appendChild(badge);
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
