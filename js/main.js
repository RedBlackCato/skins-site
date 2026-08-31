let SKINS_DATA = [];

/*
  HOW TO ADD SKIN PHOTOS:
  There are two separate images per skin, just like Steam does:

  1. "img" — the Steam icon shown on the card BEFORE clicking (.avif, gray background is normal).
     Create an "img" folder next to this index.html file, one subfolder per weapon (slug),
     one file per skin (slug), e.g.:
       img/ak-47/stattraktm-ak-47-legion-of-anubis.avif

  2. "detailImg" — your own in-game screenshot, shown INSIDE the modal after clicking.
     Create a "screens" folder next to this index.html file, same folder/file structure, e.g.:
       screens/ak-47/stattraktm-ak-47-legion-of-anubis.png

  Slugs are already set in the data. If a file isn't found, a clean placeholder shows instead,
  so you can add photos gradually without breaking anything.

  To use a different path/URL, just edit the "img" / "detailImg" value directly in SKINS_DATA.
*/

const CATEGORY_ORDER = ['Rifles','Snipers','Pistols','SMGs','Shotguns','Heavy','Knifes','Gloves'];

let state = {
  search: '',
  sortField: 'type',
  sortDir: 'asc',
  modalGroupIdx: null,
  modalSkinIdx: 0
};

function escapeHtml(str){
  if(str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatPrice(p){
  return '$' + p.toFixed(2);
}

function wearPercent(w){
  return Math.max(0, Math.min(100, w * 100));
}

function bestSkin(group){
  return group.skins[0];
}

function matchesSearch(group, q){
  if(!q) return true;
  q = q.toLowerCase();
  if(group.weapon.toLowerCase().includes(q)) return true;
  if(group.type.toLowerCase().includes(q)) return true;
  return group.skins.some(s => s.name.toLowerCase().includes(q));
}

function sortGroups(groups){
  const field = state.sortField;
  const dir = state.sortDir === 'asc' ? 1 : -1;
  return [...groups].sort((a, b) => {
    let av, bv;
    if(field === 'type'){ av = a.type; bv = b.type; }
    else if(field === 'weapon'){ av = a.weapon; bv = b.weapon; }
    else if(field === 'price'){ av = bestSkin(a).price; bv = bestSkin(b).price; }
    else if(field === 'wear'){ av = bestSkin(a).wear; bv = bestSkin(b).wear; }
    if(typeof av === 'string'){
      return av.localeCompare(bv) * dir;
    }
    return (av - bv) * dir;
  });
}

function renderGrid(){
  const container = document.getElementById('under100View');
  const q = state.search;
  let filtered = SKINS_DATA.filter(g => matchesSearch(g, q));
  const countEl = document.getElementById('resultCount');
  countEl.textContent = filtered.length + ' / ' + SKINS_DATA.length;

  if(filtered.length === 0){
    container.innerHTML = '<div class="empty-state">No results for "' + escapeHtml(q) + '"</div>';
    return;
  }

  if(state.sortField === 'type' && !q){
    let html = '';
    for(const cat of CATEGORY_ORDER){
      const items = filtered.filter(g => g.type === cat);
      if(items.length === 0) continue;
      const sorted = state.sortDir === 'desc' ? [...items].reverse() : items;
      html += '<div class="category-heading">' + escapeHtml(cat) + ' (' + items.length + ')</div>';
      html += '<div class="grid">' + sorted.map(renderCard).join('') + '</div>';
    }
    container.innerHTML = html;
  } else {
    const sorted = sortGroups(filtered);
    container.innerHTML = '<div class="grid">' + sorted.map(renderCard).join('') + '</div>';
  }

  attachCardHandlers();
}

function exteriorCode(exterior){
  const map = {
    'Factory New': 'FN',
    'Minimal Wear': 'MW',
    'Field-Tested': 'FT',
    'Well-Worn': 'WW',
    'Battle-Scarred': 'BS'
  };
  return map[exterior] || '';
}

function exteriorColor(exterior){
  const map = {
    'Factory New': 'var(--wear-green)',
    'Minimal Wear': 'var(--wear-green)',
    'Field-Tested': 'var(--wear-yellow)',
    'Well-Worn': 'var(--wear-red)',
    'Battle-Scarred': 'var(--wear-red)'
  };
  return map[exterior] || 'var(--text-faint)';
}

const WISHLIST_KEY = 'arsenal_wishlist_v1';
function loadWishlist(){
  try{
    const raw = localStorage.getItem(WISHLIST_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  }catch(e){
    return new Set();
  }
}
function saveWishlist(){
  try{
    localStorage.setItem(WISHLIST_KEY, JSON.stringify([...wishlist]));
  }catch(e){ /* storage unavailable, ignore */ }
}
const wishlist = loadWishlist();

function updateWishlistBadge(){
  const el = document.getElementById('wishlistCountBadge');
  if(el) el.textContent = wishlist.size;
}
updateWishlistBadge();

/*
  COMMUNITY LIKES (shared across every visitor):
  This uses countapi.mileshilliard.com — a free, no-signup counter API.
  IMPORTANT: this service has no per-site namespaces, all keys live in one
  shared public space. SITE_ID below makes your keys unique so they don't
  collide with anyone else's counters. Change it to something only you
  would use (e.g. your GitHub username + repo name) BEFORE you rely on
  real numbers, otherwise you might be sharing a counter with a stranger.
*/
const SITE_ID = 'arsenal-cs2-showcase-CHANGE-ME';
const COUNTAPI_BASE = 'https://countapi.mileshilliard.com/api/v1';

function communityKey(weaponSlug){
  return `${SITE_ID}_${weaponSlug}`;
}

async function bumpCommunityLike(weaponSlug, delta){
  const key = communityKey(weaponSlug);
  try{
    if(delta > 0){
      await fetch(`${COUNTAPI_BASE}/hit/${encodeURIComponent(key)}`);
    } else {
      const getRes = await fetch(`${COUNTAPI_BASE}/get/${encodeURIComponent(key)}`);
      let current = 0;
      if(getRes.ok){
        const data = await getRes.json();
        current = parseInt(data.value, 10) || 0;
      }
      const next = Math.max(0, current - 1);
      await fetch(`${COUNTAPI_BASE}/set/${encodeURIComponent(key)}?value=${next}`);
    }
  }catch(e){
    console.warn('Community like sync failed (offline or API unreachable):', e);
  }
}

async function fetchCommunityCount(weaponSlug){
  const key = communityKey(weaponSlug);
  try{
    const res = await fetch(`${COUNTAPI_BASE}/get/${encodeURIComponent(key)}`);
    if(!res.ok) return 0;
    const data = await res.json();
    return parseInt(data.value, 10) || 0;
  }catch(e){
    return 0;
  }
}

function renderCard(group){
  const skin = bestSkin(group);
  const idx = SKINS_DATA.indexOf(group);
  const wearPos = skin.wear != null ? wearPercent(skin.wear) : null;
  return `
    <div class="card" data-idx="${idx}">
      <div class="card-top-row">
        <div class="card-weapon-name">${escapeHtml(group.weapon)}</div>
        <button class="wishlist-btn${wishlist.has(group.weaponSlug) ? ' active' : ''}" data-wishlist-key="${escapeHtml(group.weaponSlug)}" aria-label="Add to wishlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
        </button>
      </div>
      <div class="thumb-wrap">
        <img src="${escapeHtml(skin.img)}" alt="${escapeHtml(skin.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="thumb-placeholder" style="display:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><line x1="12" y1="1" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="1" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="23" y2="12"/></svg>
          <span>Photo not added</span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-skin-name">${escapeHtml(skin.name)}</div>
        <div class="card-footer">
          <span class="card-price">${formatPrice(skin.price)}</span>
          ${skin.exterior ? '<span class="card-exterior" style="color:' + exteriorColor(skin.exterior) + '">' + escapeHtml(exteriorCode(skin.exterior)) + '</span>' : ''}
          ${group.skins.length > 1 ? '<span class="card-count">' + group.skins.length + ' skins</span>' : ''}
        </div>
        ${wearPos != null ? '<div class="wear-bar-mini"><i style="left:' + wearPos + '%"></i></div>' : ''}
      </div>
      <div class="card-tooltip">
        <div class="tt-row"><span class="tt-label">Price</span><span class="tt-val">${formatPrice(skin.price)}</span></div>
        <div class="tt-row"><span class="tt-label">Pattern</span><span class="tt-val">${escapeHtml(skin.pattern)}</span></div>
        <div class="tt-row"><span class="tt-label">Wear</span><span class="tt-val">${escapeHtml(skin.wearDisplay)}</span></div>
      </div>
    </div>
  `;
}

function attachCardHandlers(){
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.idx, 10);
      openModal(idx, 0);
    });
  });
  document.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.wishlistKey;
      if(wishlist.has(key)){
        wishlist.delete(key);
        btn.classList.remove('active');
        bumpCommunityLike(key, -1);
      } else {
        wishlist.add(key);
        btn.classList.add('active');
        bumpCommunityLike(key, 1);
      }
      saveWishlist();
      updateWishlistBadge();
    });
  });
}

function openModal(groupIdx, skinIdx){
  state.modalGroupIdx = groupIdx;
  state.modalSkinIdx = skinIdx;
  document.getElementById('modalOverlay').classList.add('open');
  renderModal();
  document.addEventListener('keydown', handleModalKeydown);
}

function closeModal(){
  document.getElementById('modalOverlay').classList.remove('open');
  document.removeEventListener('keydown', handleModalKeydown);
}

function handleModalKeydown(e){
  if(e.key === 'Escape') closeModal();
  if(e.key === 'ArrowLeft') navSkin(-1);
  if(e.key === 'ArrowRight') navSkin(1);
}

function navSkin(delta){
  const group = SKINS_DATA[state.modalGroupIdx];
  const len = group.skins.length;
  if(len <= 1) return;
  state.modalSkinIdx = (state.modalSkinIdx + delta + len) % len;
  renderModal();
}

function renderModal(){
  const group = SKINS_DATA[state.modalGroupIdx];
  const skin = group.skins[state.modalSkinIdx];
  const len = group.skins.length;
  const multi = len > 1;

  const modalImage = document.getElementById('modalImage');
  const oldImg = modalImage.querySelector('img');
  const oldPh = modalImage.querySelector('.thumb-placeholder');
  if(oldImg) oldImg.remove();
  if(oldPh) oldPh.remove();
  const img = document.createElement('img');
  img.src = skin.detailImg;
  img.alt = skin.name;
  img.dataset.stage = 'detail';
  img.onerror = function(){
    if(this.dataset.stage === 'detail'){
      // no in-game screenshot yet, fall back to the Steam icon
      this.dataset.stage = 'cover';
      this.src = skin.img;
      return;
    }
    this.style.display = 'none';
    const ph = document.createElement('div');
    ph.className = 'thumb-placeholder';
    ph.style.position = 'absolute';
    ph.style.inset = '0';
    ph.style.display = 'flex';
    ph.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:38px;height:38px;"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg><span>Photo not added</span>';
    modalImage.appendChild(ph);
  };
  modalImage.insertBefore(img, modalImage.firstChild);

  document.getElementById('modalThumbs').innerHTML =
    '<div class="mt" style="opacity:1;border-color:var(--brass-dim);"><img src="' + escapeHtml(skin.detailImg) + '" onerror="this.src=\'' + escapeHtml(skin.img) + '\'; this.onerror=function(){this.parentElement.style.background=\'var(--bg-elevated)\'; this.remove();};"></div>';

  document.getElementById('arrowLeft').style.display = multi ? 'flex' : 'none';
  document.getElementById('arrowRight').style.display = multi ? 'flex' : 'none';

  const wearPos = skin.wear != null ? wearPercent(skin.wear) : 0;

  document.getElementById('modalRight').innerHTML = `
    <div class="modal-eyebrow">${escapeHtml(group.type)} · ${escapeHtml(group.weapon)}</div>
    <div class="modal-title">${escapeHtml(skin.name)}</div>
    ${skin.exterior ? '<div class="modal-exterior">Exterior: ' + escapeHtml(skin.exterior) + '</div>' : ''}
    <div class="modal-wearbar-wrap">
      <div class="modal-wearbar-label"><span>FN</span><span>BS</span></div>
      <div class="modal-wearbar"><i style="left:${wearPos}%"></i></div>
    </div>
    <div class="modal-stats">
      <div class="stat-box"><div class="sl">Pattern Template</div><div class="sv">${escapeHtml(skin.pattern)}</div></div>
      <div class="stat-box"><div class="sl">Wear Rating</div><div class="sv">${escapeHtml(skin.wearDisplay)}</div></div>
      ${skin.nametag ? '<div class="stat-box" style="grid-column:1/-1;"><div class="sl">Name Tag</div><div class="sv">' + escapeHtml(skin.nametag) + '</div></div>' : ''}
    </div>
    <div class="modal-price-row">
      <span class="modal-price">${formatPrice(skin.price)}</span>
      <a class="buy-btn" href="${escapeHtml(skin.link)}" target="_blank" rel="noopener">
        Buy on Steam
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
    </div>
    <div class="modal-desc">${escapeHtml(skin.desc)}</div>
    ${multi ? '<div class="skin-position">Skin ' + (state.modalSkinIdx + 1) + ' of ' + len + '</div>' : ''}
  `;

  renderPeeks(group, len, multi);
}

function renderPeeks(group, len, multi){
  const peekLeft = document.getElementById('peekLeft');
  const peekRight = document.getElementById('peekRight');
  if(!multi){
    peekLeft.classList.add('hidden-peek');
    peekRight.classList.add('hidden-peek');
    peekLeft.innerHTML = '';
    peekRight.innerHTML = '';
    return;
  }
  peekLeft.classList.remove('hidden-peek');
  peekRight.classList.remove('hidden-peek');
  const prevIdx = (state.modalSkinIdx - 1 + len) % len;
  const nextIdx = (state.modalSkinIdx + 1) % len;
  const prevSkin = group.skins[prevIdx];
  const nextSkin = group.skins[nextIdx];
  peekLeft.innerHTML = '<img src="' + escapeHtml(prevSkin.detailImg) + '" onerror="this.onerror=null; this.src=\'' + escapeHtml(prevSkin.img) + '\';">';
  peekRight.innerHTML = '<img src="' + escapeHtml(nextSkin.detailImg) + '" onerror="this.onerror=null; this.src=\'' + escapeHtml(nextSkin.img) + '\';">';
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if(e.target.id === 'modalOverlay') closeModal();
});
document.getElementById('arrowLeft').addEventListener('click', () => navSkin(-1));
document.getElementById('arrowRight').addEventListener('click', () => navSkin(1));
document.getElementById('peekLeft').addEventListener('click', () => navSkin(-1));
document.getElementById('peekRight').addEventListener('click', () => navSkin(1));

document.getElementById('searchInput').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderGrid();
});
document.getElementById('sortSelect').addEventListener('change', (e) => {
  state.sortField = e.target.value;
  renderGrid();
});
document.getElementById('dirBtn').addEventListener('click', (e) => {
  state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  e.currentTarget.classList.toggle('desc');
  renderGrid();
});

function activateTab(tab){
  document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('under100View').style.display = tab === 'under100' ? 'block' : 'none';
  document.getElementById('bundleView').style.display = tab === 'bundle' ? 'block' : 'none';
  document.getElementById('communityView').style.display = tab === 'community' ? 'block' : 'none';
  document.getElementById('controlsBar').style.display = tab === 'under100' ? 'flex' : 'none';
  if(tab === 'community') loadCommunityTab();
}

// Both the header nav (.tab-btn) and the hero CTA buttons (.hero-btn) carry
// a matching data-tab attribute, so one listener drives all of them.
document.querySelectorAll('[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

async function loadCommunityTab(){
  const grid = document.getElementById('communityGrid');
  grid.innerHTML = '<div class="empty-state">Loading community likes...</div>';

  const counted = await Promise.all(
    SKINS_DATA.map(async (group) => ({
      group,
      count: await fetchCommunityCount(group.weaponSlug)
    }))
  );

  // Group by count, walk from highest to lowest, fill to exactly 5,
  // picking randomly within the bucket that would otherwise overflow.
  const byCount = new Map();
  for(const item of counted){
    if(!byCount.has(item.count)) byCount.set(item.count, []);
    byCount.get(item.count).push(item);
  }
  const countsDesc = [...byCount.keys()].sort((a, b) => b - a);

  const top5 = [];
  for(const c of countsDesc){
    const bucket = byCount.get(c);
    const remaining = 5 - top5.length;
    if(remaining <= 0) break;
    if(bucket.length <= remaining){
      top5.push(...bucket);
    } else {
      const shuffled = [...bucket].sort(() => Math.random() - 0.5);
      top5.push(...shuffled.slice(0, remaining));
    }
  }

  if(top5.length === 0){
    grid.innerHTML = '<div class="empty-state">No community likes yet — be the first to add a heart on the "Best Under $100" tab!</div>';
    return;
  }

  grid.innerHTML = '<div class="grid">' + top5.map((item, rank) => renderCommunityCard(item, rank)).join('') + '</div>';
  attachCardHandlers();
}

function renderCommunityCard(item, rank){
  const { group, count } = item;
  const idx = SKINS_DATA.indexOf(group);
  const skin = bestSkin(group);
  const wearPos = skin.wear != null ? wearPercent(skin.wear) : null;
  return `
    <div class="card" data-idx="${idx}">
      <div class="card-top-row">
        <div class="card-weapon-name">${escapeHtml(group.weapon)}</div>
        <button class="wishlist-btn${wishlist.has(group.weaponSlug) ? ' active' : ''}" data-wishlist-key="${escapeHtml(group.weaponSlug)}" aria-label="Add to wishlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
        </button>
      </div>
      <div class="thumb-wrap">
        <div class="rank-badge">#${rank + 1}</div>
        <img src="${escapeHtml(skin.img)}" alt="${escapeHtml(skin.name)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="thumb-placeholder" style="display:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg>
          <span>Photo not added</span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-skin-name">${escapeHtml(skin.name)}</div>
        <div class="card-footer">
          <span class="card-price">${formatPrice(skin.price)}</span>
          <span class="like-count">${count} ${count === 1 ? 'like' : 'likes'}</span>
        </div>
        ${wearPos != null ? '<div class="wear-bar-mini"><i style="left:' + wearPos + '%"></i></div>' : ''}
      </div>
      <div class="card-tooltip">
        <div class="tt-row"><span class="tt-label">Price</span><span class="tt-val">${formatPrice(skin.price)}</span></div>
        <div class="tt-row"><span class="tt-label">Pattern</span><span class="tt-val">${escapeHtml(skin.pattern)}</span></div>
        <div class="tt-row"><span class="tt-label">Wear</span><span class="tt-val">${escapeHtml(skin.wearDisplay)}</span></div>
      </div>
    </div>
  `;
}

async function loadData(){
  const container = document.getElementById('under100View');
  try{
    const res = await fetch('js/skins-data.json');
    if(!res.ok) throw new Error('HTTP ' + res.status);
    SKINS_DATA = await res.json();
    renderGrid();
  }catch(err){
    container.innerHTML = '<div class="empty-state">Could not load skins-data.json.<br>Make sure it sits next to index.html, and that you are viewing this page through a server (e.g. GitHub Pages or a local dev server) rather than opening the file directly.</div>';
    console.error('Failed to load skins-data.json:', err);
  }
}

loadData();