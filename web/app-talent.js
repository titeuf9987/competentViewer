// "Référentiel Talent" tab — a separate, unrelated dataset (bilingual
// competency framework) from the Competent (VDAB) tab. Wrapped in its own
// IIFE so it shares no state with CompetentApp; app-shell.js drives it
// through the small surface returned at the bottom.
const TalentApp = (function () {
  const PREFIX = 'talent';
  let DATA = null;
  let loading = false;

  const app = document.getElementById('app');

  function parseFileToData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
          resolve(parseTalentWorkbook(wb, file.name));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
      reader.readAsArrayBuffer(file);
    });
  }

  function loadFile(file) {
    return parseFileToData(file).then((data) => { DATA = data; });
  }

  async function init() {
    loading = true;
    app.innerHTML = '<p class="stats-line" style="text-align:center;margin-top:60px;">Chargement des données…</p>';
    try {
      const res = await fetch('data/talent.xlsx', { cache: 'no-store' });
      if (!res.ok) throw new Error('fichier par défaut introuvable');
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      DATA = parseTalentWorkbook(wb, 'talent.xlsx (fichier par défaut)');
    } catch (err) {
      DATA = null;
    }
    loading = false;
  }

  // ---------- helpers ----------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function pick(langObj, preferred) {
    if (!langObj) return null;
    const order = preferred === 'nl' ? ['nl', 'fr'] : ['fr', 'nl'];
    for (const k of order) if (langObj[k]) return langObj[k];
    return null;
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function navigate(hash) {
    location.hash = hash;
  }

  function block(title, count, innerHtml) {
    if (count === 0) return '';
    return `<section class="block"><h3>${esc(title)} <span class="count">${count}</span></h3>${innerHtml}</section>`;
  }

  function twoColLang(obj) {
    if (!obj) return '';
    const fr = obj.fr ? `<div><span class="lang-label">FR</span>${esc(obj.fr)}</div>` : '';
    const nl = obj.nl ? `<div><span class="lang-label">NL</span>${esc(obj.nl)}</div>` : '';
    if (!fr && !nl) return '';
    return `<div class="two-col"><div class="text-block">${fr}</div><div class="text-block">${nl}</div></div>`;
  }

  function competenceChip(id) {
    const c = DATA.competences[id];
    const label = c ? (pick(c.title, currentLang) || id) : id;
    return `<button class="chip" data-nav="#/${PREFIX}/competence/${esc(id)}"><span class="code">${esc(id)}</span>${esc(label)}</button>`;
  }

  function niveauChip(levelKey, marqueur) {
    const label = levelKey + (marqueur ? ` (${marqueur})` : '');
    return `<button class="chip" data-nav="#/${PREFIX}/niveau/${esc(encodeURIComponent(levelKey))}">${esc(label)}</button>`;
  }

  function familleChip(key) {
    const f = DATA.familles[key];
    const label = f ? (pick(f.title, currentLang) || key) : key;
    return `<button class="chip" data-nav="#/${PREFIX}/famille/${esc(key)}">${esc(label)}</button>`;
  }

  // ---------- router ----------

  function renderRoute(parts) {
    app.innerHTML = '';
    if (!DATA) {
      app.appendChild(renderUpload());
      return;
    }
    if (parts.length === 0) {
      app.appendChild(renderHome());
    } else if (parts[0] === 'competence' && parts[1]) {
      app.appendChild(renderCompetencePage(parts[1]));
    } else if (parts[0] === 'niveau' && parts[1]) {
      app.appendChild(renderNiveauPage(decodeURIComponent(parts[1])));
    } else if (parts[0] === 'famille' && parts[1]) {
      app.appendChild(renderFamillePage(parts[1]));
    } else {
      app.appendChild(renderHome());
    }
    app.querySelectorAll('[data-nav]').forEach((n) => {
      n.addEventListener('click', () => navigate(n.dataset.nav));
    });
    window.scrollTo(0, 0);
  }

  // ---------- upload screen ----------

  function renderUpload() {
    const wrap = el(`
      <div>
        <div class="entry-card" style="max-width:640px;margin:40px auto;">
          <h2>Charger un référentiel Talent (.xlsx)</h2>
          <p class="hint">Le fichier par défaut n'a pas pu être chargé automatiquement. Rien n'est envoyé nulle part : le fichier est lu et interprété directement dans votre navigateur. Glissez-déposez le fichier ci-dessous, ou choisissez-le.</p>
          <div id="dropzone-talent" style="border:2px dashed var(--border);border-radius:10px;padding:36px 16px;text-align:center;cursor:pointer;">
            <div style="font-size:14px;color:var(--muted);">Glissez le fichier .xlsx ici, ou cliquez pour parcourir</div>
            <input id="file-input-talent" type="file" accept=".xlsx" style="display:none;">
          </div>
          <div id="upload-status-talent" class="stats-line"></div>
        </div>
      </div>
    `);
    const dropzone = wrap.querySelector('#dropzone-talent');
    const input = wrap.querySelector('#file-input-talent');
    const status = wrap.querySelector('#upload-status-talent');

    function handle(file) {
      status.textContent = `Lecture de ${file.name}…`;
      loadFile(file).then(() => {
        location.hash = `#/${PREFIX}`;
        renderRoute([]);
      }).catch((err) => {
        console.error(err);
        status.textContent = `Erreur lors de la lecture du fichier : ${err.message}`;
      });
    }

    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.background = 'var(--accent-soft)'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.background = ''; });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.background = '';
      if (e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', () => {
      if (input.files[0]) handle(input.files[0]);
    });

    return wrap;
  }

  // ---------- home ----------

  function renderHome() {
    const wrap = el(`
      <div>
        <div class="entrypoints">
          <div class="entry-card">
            <h2>Par compétence</h2>
            <p class="hint">Parcourez ou cherchez une des 40 compétences du référentiel pour voir sa description, ses niveaux, ses dimensions et son texte source.</p>
            <div class="search-box">
              <input id="search-competence-t" placeholder="Ex: Communiquer, Résoudre des problèmes…">
              <div class="search-results" id="results-competence-t"></div>
            </div>
          </div>
          <div class="entry-card">
            <h2>Par niveau</h2>
            <p class="hint">Parcourez ou cherchez un niveau (D, C, B, A…) pour voir toutes les compétences qui s'y déclinent.</p>
            <div class="search-box">
              <input id="search-niveau-t" placeholder="Ex: D, C, B, A…">
              <div class="search-results" id="results-niveau-t"></div>
            </div>
          </div>
        </div>
        <p class="stats-line">${DATA.meta.competenceCount} compétences · ${DATA.meta.familyCount} familles · ${DATA.meta.levelCount} niveaux — source : ${esc(DATA.meta.generatedFrom)}</p>
      </div>
    `);

    const searchComp = wrap.querySelector('#search-competence-t');
    const resultsComp = wrap.querySelector('#results-competence-t');
    searchComp.addEventListener('input', () => renderCompResults(resultsComp, searchComp.value.trim()));
    renderCompResults(resultsComp, '');

    const searchNiv = wrap.querySelector('#search-niveau-t');
    const resultsNiv = wrap.querySelector('#results-niveau-t');
    searchNiv.addEventListener('input', () => renderNiveauResults(resultsNiv, searchNiv.value.trim()));
    renderNiveauResults(resultsNiv, '');

    return wrap;
  }

  function matchScore(label, q) {
    const l = label.toLowerCase();
    if (l === q) return 0;
    if (l.startsWith(q)) return 1;
    if (l.includes(q)) return 2;
    return -1;
  }

  function renderCompResults(container, query) {
    const all = Object.values(DATA.competences).map((c) => ({
      nav: `#/${PREFIX}/competence/${c.id}`, code: c.id, label: pick(c.title, currentLang) || c.id,
    }));
    if (!query) {
      renderResultList(container, all.sort((a, b) => a.label.localeCompare(b.label)));
      return;
    }
    const q = query.toLowerCase();
    const results = all.map((r) => ({ ...r, score: matchScore(r.label, q) })).filter((r) => r.score !== -1);
    results.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label));
    renderResultList(container, results);
  }

  function renderNiveauResults(container, query) {
    const all = Object.keys(DATA.niveaux).map((key) => ({
      nav: `#/${PREFIX}/niveau/${encodeURIComponent(key)}`, code: `${DATA.niveaux[key].competences.length}`, label: key,
    }));
    if (!query) {
      renderResultList(container, all.sort((a, b) => a.label.localeCompare(b.label)));
      return;
    }
    const q = query.toLowerCase();
    const results = all.map((r) => ({ ...r, score: matchScore(r.label, q) })).filter((r) => r.score !== -1);
    results.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label));
    renderResultList(container, results);
  }

  function renderResultList(container, items) {
    if (items.length === 0) { container.innerHTML = '<div class="search-result-item">Aucun résultat</div>'; return; }
    container.innerHTML = items.map((it) => `
      <div class="search-result-item" data-nav="${esc(it.nav)}">
        <span class="code">${esc(it.code)}</span>
        <span>${esc(it.label)}</span>
      </div>
    `).join('');
    container.querySelectorAll('[data-nav]').forEach((n) => n.addEventListener('click', () => navigate(n.dataset.nav)));
  }

  // ---------- competence page ----------

  function renderCompetencePage(id) {
    const c = DATA.competences[id];
    if (!c) return el(`<div><p>Compétence introuvable : ${esc(id)}</p></div>`);
    const title = pick(c.title, currentLang) || id;

    const identBlock = `
      <section class="block">
        <h3>Identification</h3>
        <dl class="kv-grid">
          <dt>Code</dt><dd>${esc(c.id)}</dd>
          <dt>Page</dt><dd>${esc(c.page)}</dd>
          <dt>Famille</dt><dd>${familleChip(c.familyKey)}</dd>
          ${c.marqueur ? `<dt>Marqueur</dt><dd><span class="badge neutral">${esc(c.marqueur)}</span></dd>` : ''}
          ${c.source.fr ? `<dt>Source (FR)</dt><dd>${esc(c.source.fr)}</dd>` : ''}
          ${c.source.nl ? `<dt>Source (NL)</dt><dd>${esc(c.source.nl)}</dd>` : ''}
        </dl>
      </section>
    `;

    const descBlock = (c.description.fr || c.description.nl) ? `<section class="block"><h3>Description</h3>${twoColLang(c.description)}</section>` : '';

    const niveauxBlock = block('Niveaux', c.niveaux.length, `
      <table class="simple">
        <thead><tr><th>Ordre</th><th>Niveau (FR)</th><th>Niveau (NL)</th><th>Marqueur</th><th>Page</th></tr></thead>
        <tbody>${c.niveaux.map((n) => `
          <tr>
            <td>${esc(n.ordre)}</td>
            <td>${niveauChip(n.levelKey, null)}</td>
            <td>${esc(n.niveau.nl || '')}</td>
            <td>${n.marqueur ? `<span class="badge neutral">${esc(n.marqueur)}</span>` : ''}</td>
            <td>${esc(n.pageSource)}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    `);

    const dimensionsBlock = block('Dimensions', c.dimensions.length, c.dimensions.map((d) => `
      <div class="competence-card">
        <div class="cc-meta">
          <span class="badge neutral">${esc(d.symbole || d.type)}</span> ${esc(d.type)}${d.digCompCode ? ` · DigComp ${esc(d.digCompCode)}` : ''} · ordre ${esc(d.ordre)} · page ${esc(d.pageSource)}
        </div>
        <div class="cc-title" style="cursor:default;color:var(--text);">${esc(pick(d.title, currentLang) || '')}</div>
        ${twoColLang(d.description)}
      </div>
    `).join(''));

    const texteBlock = c.texteSource ? `
      <section class="block">
        <h3>Texte source</h3>
        <div class="two-col">
          <div>
            <div class="lang-label">FR</div>
            <div class="text-block" style="white-space:pre-wrap;font-size:12px;max-height:400px;overflow-y:auto;">${esc(c.texteSource.texte.fr || '')}</div>
          </div>
          <div>
            <div class="lang-label">NL</div>
            <div class="text-block" style="white-space:pre-wrap;font-size:12px;max-height:400px;overflow-y:auto;">${esc(c.texteSource.texte.nl || '')}</div>
          </div>
        </div>
      </section>
    ` : '';

    const wrap = el(`
      <div>
        <div class="breadcrumb"><a data-nav="#/${PREFIX}">Accueil</a> / Compétence</div>
        <div class="detail-header">
          <span class="code-tag">${esc(c.id)}</span>
          <h2>${esc(title)}</h2>
        </div>
        ${identBlock}
        ${descBlock}
        ${niveauxBlock}
        ${dimensionsBlock}
        ${texteBlock}
      </div>
    `);
    return wrap;
  }

  // ---------- niveau page ----------

  function renderNiveauPage(levelKey) {
    const niveau = DATA.niveaux[levelKey];
    if (!niveau) return el(`<div><p>Niveau introuvable : ${esc(levelKey)}</p></div>`);

    const groups = {};
    for (const c of niveau.competences) {
      const g = c.exactLevel || levelKey;
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    }
    const groupKeys = Object.keys(groups).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10);
      const nb = parseInt(b.replace(/\D/g, ''), 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    const isCumulative = groupKeys.length > 1;

    const groupsHtml = groupKeys.map((g) => `
      <div class="subgroup">
        <div class="label">${esc(g)}${g === levelKey ? ' (spécifique)' : ''} <span class="count">${groups[g].length}</span></div>
        <div class="chips">${groups[g].map((c) => competenceChip(c.id)).join('')}</div>
      </div>
    `).join('');

    const wrap = el(`
      <div>
        <div class="breadcrumb"><a data-nav="#/${PREFIX}">Accueil</a> / Niveau</div>
        <div class="detail-header">
          <span class="code-tag">${esc(levelKey)}</span>
          <h2>${esc(levelKey)}</h2>
          ${isCumulative ? `<div class="subtitle">Niveau cumulatif : ${esc(levelKey)} inclut les niveaux ${esc(groupKeys.filter((g) => g !== levelKey).join(', '))} + ce qui est spécifique à ${esc(levelKey)}</div>` : ''}
        </div>
        <section class="block">
          <h3>Compétences concernées <span class="count">${niveau.competences.length}</span></h3>
          ${groupsHtml}
        </section>
      </div>
    `);
    return wrap;
  }

  // ---------- famille page ----------

  function renderFamillePage(key) {
    const f = DATA.familles[key];
    if (!f) return el(`<div><p>Famille introuvable : ${esc(key)}</p></div>`);
    const title = pick(f.title, currentLang) || key;

    const wrap = el(`
      <div>
        <div class="breadcrumb"><a data-nav="#/${PREFIX}">Accueil</a> / Famille</div>
        <div class="detail-header">
          <h2>${esc(title)}</h2>
        </div>
        <section class="block">
          <h3>Compétences de cette famille <span class="count">${f.competences.length}</span></h3>
          <div class="chips">${f.competences.map(competenceChip).join('')}</div>
        </section>
      </div>
    `);
    return wrap;
  }

  return {
    prefix: PREFIX,
    init,
    renderRoute,
    loadFile,
    hasData: () => !!DATA,
    isLoading: () => loading,
  };
})();
