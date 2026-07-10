// Shared header chrome: tab switching, the refresh button, and the FR/NL
// toggle. Delegates all actual rendering to CompetentApp or TalentApp,
// whichever tab is active. The two datasets are otherwise independent,
// except for the curated Competent<->Talent competence matches (matching.js)
// shown as cross-tab links on soft skill / compétence pages.
let currentLang = 'fr';
let activeTab = 'competent';

const homeLink = document.getElementById('home-link');
const tabnav = document.getElementById('tabnav');
const refreshBtn = document.getElementById('refresh-btn');
const refreshInput = document.getElementById('header-file-input');
const refreshStatus = document.getElementById('refresh-status');
const langtoggle = document.getElementById('langtoggle');

function moduleFor(tab) {
  return tab === 'talent' ? TalentApp : CompetentApp;
}

function updateTabButtons() {
  tabnav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === activeTab));
}

async function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  const tab = parts[0] === 'talent' ? 'talent' : 'competent';
  activeTab = tab;
  updateTabButtons();
  const mod = moduleFor(tab);
  const rest = parts[0] === tab ? parts.slice(1) : parts;

  if (!mod.hasData()) {
    if (mod.isLoading()) return;
    await mod.init();
  }
  mod.renderRoute(rest);
  refreshBtn.hidden = !mod.hasData();
}

homeLink.addEventListener('click', () => {
  location.hash = `#/${activeTab}`;
});

tabnav.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  location.hash = `#/${btn.dataset.tab}`;
});

langtoggle.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-lang]');
  if (!btn) return;
  currentLang = btn.dataset.lang;
  langtoggle.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
  route();
});

refreshBtn.addEventListener('click', () => refreshInput.click());
refreshInput.addEventListener('change', () => {
  if (!refreshInput.files[0]) return;
  const file = refreshInput.files[0];
  const mod = moduleFor(activeTab);
  refreshStatus.textContent = `Lecture de ${file.name}…`;
  mod.loadFile(file).then(() => {
    refreshStatus.textContent = `Chargé : ${file.name}`;
    setTimeout(() => { refreshStatus.textContent = ''; }, 4000);
    location.hash = `#/${activeTab}`;
    route();
  }).catch((err) => {
    refreshStatus.textContent = `Erreur : ${err.message}`;
  });
  refreshInput.value = '';
});

// The active tab's own data is loaded by route(). The other tab's default
// data, plus the cross-tab matching table, are fetched in the background
// (both are small) so that cross-links resolve without waiting for the
// user to actually visit the other tab; once ready, re-render in place.
async function bootstrapCrossLinks() {
  const jobs = [ensureMatchesLoaded()];
  if (!CompetentApp.hasData() && !CompetentApp.isLoading()) jobs.push(CompetentApp.init());
  if (!TalentApp.hasData() && !TalentApp.isLoading()) jobs.push(TalentApp.init());
  await Promise.allSettled(jobs);
  route();
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  route();
  bootstrapCrossLinks();
});
