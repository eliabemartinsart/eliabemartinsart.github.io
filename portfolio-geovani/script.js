const archive = [
  { period: 'JULHO', year: 2024, items: [
    { id: 'C9uPemAuV0D', day: '22', number: '12' },
    { id: 'C9iC7e2PElx', day: '17', number: '11' },
    { id: 'C9WDFdWvAuP', day: '12', number: '10' },
    { id: 'C9TtOh3uaFV', day: '12', number: '09' }
  ]},
  { period: 'JANEIRO', year: 2024, items: [
    { id: 'C2xDmnBuquN', day: '31', number: '08' },
    { id: 'C2SmVK_PRFo', day: '19', number: '07' },
    { id: 'C2F0PfovTGc', day: '14', number: '06' },
    { id: 'C2DWxezPZ37', day: '13', number: '05' }
  ]},
  { period: 'JULHO', year: 2023, items: [
    { id: 'CvJDT91IVTR', day: '25', number: '04', orientation: 'landscape' },
    { id: 'CuzwsFwqyze', day: '17', number: '03' },
    { id: 'Cuw3xwQoP_a', day: '16', number: '02' },
    { id: 'CuuHuv5odG6', day: '15', number: '01' }
  ]}
];

let embedScriptPromise;
function ensureInstagramEmbed() {
  if (window.instgrm?.Embeds?.process) return Promise.resolve();
  if (embedScriptPromise) return embedScriptPromise;
  embedScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('O player do Instagram não pôde ser carregado.'));
    document.head.append(script);
  });
  return embedScriptPromise;
}

function makeCard(item, group, featured) {
  const url = `https://www.instagram.com/reel/${item.id}/`;
  const card = document.createElement('article');
  card.className = `reel-card${featured ? ' featured-reel' : ''}`;
  card.innerHTML = `
    <div class="reel-media ${item.orientation || 'portrait'}">
      <button type="button" class="reel-cover" aria-label="Reproduzir registro ${item.number} do CIM, ${group.period.toLowerCase()} de ${group.year}">
        <img src="./covers/${item.id}.jpg" alt="Capa original do vídeo ${item.number} do CIM" loading="lazy" decoding="async">
        <span class="cover-id">CIM / ${group.year}</span>
        <span class="play-icon" aria-hidden="true">▶</span>
        <span class="cover-hint">REPRODUZIR VÍDEO ↗</span>
      </button>
      <div class="reel-player" hidden data-reel-url="${url}" data-reel-number="${item.number}" aria-label="Vídeo ${item.number} do CIM, ${group.period.toLowerCase()} de ${group.year}">
        <span class="player-loading">Carregando vídeo do Instagram…</span>
      </div>
    </div>
    <div class="reel-info">
      <div><div class="reel-info-top"><span>REGISTRO ${item.number}</span><span>${group.period} ${group.year}</span></div>
        <h3>Cobertura do CIM</h3><p>Captação, edição e publicação de conteúdo para o Curso de Imersão Missionária.</p></div>
      <a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Abrir registro ${item.number} na publicação original do Instagram">Abrir publicação original <span aria-hidden="true">↗</span></a>
    </div>`;
  card.querySelector('.reel-cover').addEventListener('click', () => {
    const cover = card.querySelector('.reel-cover');
    const player = card.querySelector('.reel-player');
    cover.hidden = true;
    player.hidden = false;
    mountPlayer(player);
  });
  return card;
}

function showPlayerFallback(player) {
  if (!player.isConnected || player.querySelector('iframe')) return;
  const url = player.dataset.reelUrl;
  player.innerHTML = `<p class="player-message">O Instagram não liberou a reprodução aqui. <a href="${url}" target="_blank" rel="noopener noreferrer">Assistir na publicação original ↗</a><br><button type="button" class="return-cover">Voltar à capa</button></p>`;
  player.querySelector('.return-cover').addEventListener('click', () => {
    player.hidden = true;
    player.parentElement.querySelector('.reel-cover').hidden = false;
  });
}

async function mountPlayer(player) {
  if (!player.isConnected || player.dataset.started) return;
  player.dataset.started = 'true';
  const quote = document.createElement('blockquote');
  quote.className = 'instagram-media';
  quote.dataset.instgrmPermalink = player.dataset.reelUrl;
  quote.dataset.instgrmVersion = '14';
  const link = document.createElement('a');
  link.href = player.dataset.reelUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = `Assistir ao registro ${player.dataset.reelNumber} no Instagram`;
  quote.append(link);
  player.append(quote);
  const observer = new MutationObserver(() => {
    if (player.querySelector('iframe')) {
      player.classList.add('is-ready');
      observer.disconnect();
    }
  });
  observer.observe(player, { childList: true, subtree: true });
  try {
    await ensureInstagramEmbed();
    if (player.isConnected) window.instgrm.Embeds.process();
  } catch {
    observer.disconnect();
    showPlayerFallback(player);
    return;
  }
  window.setTimeout(() => {
    observer.disconnect();
    showPlayerFallback(player);
  }, 12000);
}

function renderArchive(filter = 'all') {
  const container = document.getElementById('video-archive');
  const fragment = document.createDocumentFragment();
  archive.filter(group => filter === 'all' || String(group.year) === filter).forEach((group, groupIndex) => {
    const section = document.createElement('section');
    section.className = 'archive-group';
    section.setAttribute('aria-label', `${group.period.toLowerCase()} de ${group.year}`);
    const heading = document.createElement('div');
    heading.className = 'archive-sticky';
    heading.innerHTML = `<h3 class="archive-period">${group.period === 'JANEIRO' ? 'JAN' : 'JUL'}<em>.</em><br>${group.year}</h3><span class="archive-month">${group.period} / ${group.items.length} VÍDEOS</span>`;
    const list = document.createElement('div');
    list.className = 'archive-list';
    group.items.forEach((item, index) => list.append(makeCard(item, group, groupIndex === 0 && index === 0)));
    section.append(heading, list);
    fragment.append(section);
  });
  container.replaceChildren(fragment);
}

document.querySelectorAll('.filter').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach(other => {
      const selected = other === button;
      other.classList.toggle('active', selected);
      other.setAttribute('aria-pressed', String(selected));
    });
    renderArchive(button.dataset.filter);
  });
});
renderArchive();
