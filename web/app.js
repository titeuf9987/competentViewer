let DATA = null;
let currentLang = 'fr';

const app = document.getElementById('app');

document.getElementById('home-link').addEventListener('click', () => {
  if (!DATA) return;
  location.hash = '#/';
});

document.getElementById('langtoggle').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-lang]');
  if (!btn) return;
  currentLang = btn.dataset.lang;
  document.querySelectorAll('#langtoggle button').forEach((b) => b.classList.toggle('active', b === btn));
  render();
});

const refreshBtn = document.getElementById('refresh-btn');
const refreshInput = document.getElementById('header-file-input');
const refreshStatus = document.getElementById('refresh-status');

refreshBtn.addEventListener('click', () => refreshInput.click());
refreshInput.addEventListener('change', () => {
  if (!refreshInput.files[0]) return;
  const file = refreshInput.files[0];
  refreshStatus.textContent = `Lecture de ${file.name}…`;
  parseFileToData(file).then((data) => {
    DATA = data;
    refreshStatus.textContent = `Chargé : ${file.name}`;
    setTimeout(() => { refreshStatus.textContent = ''; }, 4000);
    location.hash = '#/';
    render();
  }).catch((err) => {
    refreshStatus.textContent = `Erreur : ${err.message}`;
  });
  refreshInput.value = '';
});

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', init);

function parseFileToData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        resolve(parseCompetentWorkbook(wb, file.name));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Impossible de lire le fichier.'));
    reader.readAsArrayBuffer(file);
  });
}

async function init() {
  app.innerHTML = '<p class="stats-line" style="text-align:center;margin-top:60px;">Chargement des données…</p>';
  try {
    const res = await fetch('data/export.xlsx', { cache: 'no-store' });
    if (!res.ok) throw new Error('fichier par défaut introuvable');
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    DATA = parseCompetentWorkbook(wb, 'export.xlsx (fichier par défaut)');
  } catch (err) {
    DATA = null;
  }
  render();
}

// ---------- helpers ----------

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pick(langObj, preferred) {
  if (!langObj) return null;
  const order = preferred === 'nl' ? ['nl', 'fr', 'en', 'de'] : ['fr', 'nl', 'en', 'de'];
  for (const k of order) if (langObj[k]) return langObj[k];
  return null;
}

function otherLangTitle(langObj, preferred) {
  const other = preferred === 'nl' ? 'fr' : 'nl';
  return langObj && langObj[other] ? langObj[other] : null;
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(currentLang === 'nl' ? 'nl-BE' : 'fr-BE', { year: 'numeric', month: 'long', day: 'numeric' });
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstChild;
}

function navigate(hash) {
  location.hash = hash;
}

function occChip(opCode) {
  const op = DATA.occupations[opCode];
  const label = op ? (pick(op.title, currentLang) || opCode) : opCode;
  return `<button class="chip" data-nav="#/metier/${esc(opCode)}"><span class="code">${esc(opCode)}</span>${esc(label)}</button>`;
}

function skillChip(skillCode, cls) {
  const sk = DATA.skills[skillCode];
  const label = sk ? (pick(sk.title, currentLang) || skillCode) : skillCode;
  return `<button class="chip ${cls || ''}" data-nav="#/competence/skill/${esc(skillCode)}"><span class="code">${esc(skillCode)}</span>${esc(label)}</button>`;
}

function softChip(code) {
  const s = DATA.softSkills[code];
  const label = s ? (pick(s.title, currentLang) || code) : code;
  return `<button class="chip soft" data-nav="#/competence/soft/${esc(code)}"><span class="code">${esc(code)}</span>${esc(label)}</button>`;
}

function digitalChip(code) {
  const s = DATA.digitalSkills[code];
  const label = s ? (pick(s.title, currentLang) || code) : code;
  return `<button class="chip digital" data-nav="#/competence/digital/${esc(code)}"><span class="code">${esc(code)}</span>${esc(label)}</button>`;
}

function block(title, count, innerHtml) {
  if (count === 0) return '';
  return `<section class="block"><h3>${esc(title)} <span class="count">${count}</span></h3>${innerHtml}</section>`;
}

// ---------- router ----------

function render() {
  app.innerHTML = '';
  refreshBtn.hidden = !DATA;
  if (!DATA) {
    app.appendChild(renderUpload());
    return;
  }
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) {
    app.appendChild(renderHome());
  } else if (parts[0] === 'metier' && parts[1]) {
    app.appendChild(renderOccupationPage(parts[1]));
  } else if (parts[0] === 'competence' && parts[1] === 'skill' && parts[2]) {
    app.appendChild(renderSkillPage(parts[2]));
  } else if (parts[0] === 'competence' && parts[1] === 'soft' && parts[2]) {
    app.appendChild(renderSoftDigitalPage('soft', parts[2]));
  } else if (parts[0] === 'competence' && parts[1] === 'digital' && parts[2]) {
    app.appendChild(renderSoftDigitalPage('digital', parts[2]));
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
        <h2>Charger un export Competent (.xlsx)</h2>
        <p class="hint">Le fichier par défaut n'a pas pu être chargé automatiquement. Rien n'est envoyé nulle part : le fichier est lu et interprété directement dans votre navigateur. Glissez-déposez le fichier ci-dessous, ou choisissez-le.</p>
        <div id="dropzone" style="border:2px dashed var(--border);border-radius:10px;padding:36px 16px;text-align:center;cursor:pointer;">
          <div style="font-size:14px;color:var(--muted);">Glissez le fichier .xlsx ici, ou cliquez pour parcourir</div>
          <input id="file-input" type="file" accept=".xlsx" style="display:none;">
        </div>
        <div id="upload-status" class="stats-line"></div>
      </div>
    </div>
  `);
  const dropzone = wrap.querySelector('#dropzone');
  const input = wrap.querySelector('#file-input');
  const status = wrap.querySelector('#upload-status');

  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.background = 'var(--accent-soft)'; });
  dropzone.addEventListener('dragleave', () => { dropzone.style.background = ''; });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.background = '';
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0], status);
  });
  input.addEventListener('change', () => {
    if (input.files[0]) loadFile(input.files[0], status);
  });

  return wrap;
}

function loadFile(file, statusEl) {
  statusEl.textContent = `Lecture de ${file.name}…`;
  parseFileToData(file).then((data) => {
    DATA = data;
    location.hash = '#/';
    render();
  }).catch((err) => {
    console.error(err);
    statusEl.textContent = `Erreur lors de la lecture du fichier : ${err.message}`;
  });
}

// ---------- home ----------

function renderHome() {
  const wrap = el(`
    <div>
      <div class="entrypoints">
        <div class="entry-card">
          <h2>Par métier</h2>
          <p class="hint">Parcourez ou cherchez un métier pour voir tout ce qui lui est lié : compétences, soft &amp; digital skills, secteurs, preuves d'apprentissage…</p>
          <div class="search-box">
            <input id="search-metier" placeholder="Ex: Architecte, Content marketeer…">
            <div class="search-results" id="results-metier"></div>
          </div>
        </div>
        <div class="entry-card">
          <h2>Par compétence</h2>
          <p class="hint">Parcourez ou cherchez une compétence, un soft skill ou un digital skill pour voir tous les métiers concernés.</p>
          <div class="search-box">
            <input id="search-competence" placeholder="Ex: Communiceren, Analyseren…">
            <div class="search-results" id="results-competence"></div>
          </div>
        </div>
      </div>
      <p class="stats-line">${DATA.meta.occupationCount} métiers · ${DATA.meta.skillCount} compétences · ${DATA.meta.softSkillCount} soft skills · ${DATA.meta.digitalSkillCount} digital skills · ${DATA.meta.competenceSetCount} ensembles de compétences — source : ${esc(DATA.meta.generatedFrom)}</p>
    </div>
  `);

  const searchMetier = wrap.querySelector('#search-metier');
  const resultsMetier = wrap.querySelector('#results-metier');
  searchMetier.addEventListener('input', () => {
    renderOccResults(resultsMetier, searchMetier.value.trim());
  });
  renderOccResults(resultsMetier, '');

  const searchComp = wrap.querySelector('#search-competence');
  const resultsComp = wrap.querySelector('#results-competence');
  searchComp.addEventListener('input', () => {
    renderCompResults(resultsComp, searchComp.value.trim());
  });
  renderCompResults(resultsComp, '');

  return wrap;
}

function matchScore(label, q) {
  const l = label.toLowerCase();
  if (l === q) return 0;
  if (l.startsWith(q)) return 1;
  if (l.includes(q)) return 2;
  return -1;
}

function renderOccResults(container, query) {
  if (!query) {
    const all = Object.values(DATA.occupations)
      .map((op) => ({ nav: `#/metier/${op.id}`, code: op.id, label: pick(op.title, currentLang) || op.id, sub: null, kindLabel: null, kindCls: '' }))
      .sort((a, b) => a.label.localeCompare(b.label));
    renderResultList(container, all);
    return;
  }
  const q = query.toLowerCase();
  const results = [];
  for (const op of Object.values(DATA.occupations)) {
    const label = pick(op.title, currentLang) || '';
    let score = matchScore(label, q);
    let matchedAlt = null;
    if (score === -1) {
      for (const an of op.altNames) {
        if (an.title && an.title.toLowerCase().includes(q)) { score = 3; matchedAlt = an.title; break; }
      }
    }
    if (score === -1 && op.id.toLowerCase() === q) score = 0;
    if (score !== -1) results.push({ op, score, matchedAlt });
  }
  results.sort((a, b) => a.score - b.score || (pick(a.op.title, currentLang) || '').localeCompare(pick(b.op.title, currentLang) || ''));
  renderResultList(container, results.slice(0, 40).map((r) => ({
    nav: `#/metier/${r.op.id}`,
    code: r.op.id,
    label: pick(r.op.title, currentLang) || r.op.id,
    sub: r.matchedAlt ? `alias : ${r.matchedAlt}` : null,
    kindLabel: null,
    kindCls: '',
  })));
}

function allCompetenceEntries() {
  const all = [];
  for (const sk of Object.values(DATA.skills)) {
    all.push({ nav: `#/competence/skill/${sk.code}`, code: sk.code, label: pick(sk.title, currentLang) || sk.code, kindLabel: 'Compétence', kindCls: '' });
  }
  for (const ss of Object.values(DATA.softSkills)) {
    all.push({ nav: `#/competence/soft/${ss.code}`, code: ss.code, label: pick(ss.title, currentLang) || ss.code, kindLabel: 'Soft skill', kindCls: 'soft' });
  }
  for (const ds of Object.values(DATA.digitalSkills)) {
    all.push({ nav: `#/competence/digital/${ds.code}`, code: ds.code, label: pick(ds.title, currentLang) || ds.code, kindLabel: 'Digital skill', kindCls: 'digital' });
  }
  return all;
}

function renderCompResults(container, query) {
  if (!query) {
    const all = allCompetenceEntries().sort((a, b) => a.label.localeCompare(b.label));
    renderResultList(container, all);
    return;
  }
  const q = query.toLowerCase();
  const results = [];
  for (const sk of Object.values(DATA.skills)) {
    const label = pick(sk.title, currentLang) || '';
    const score = matchScore(label, q);
    if (score !== -1) results.push({ nav: `#/competence/skill/${sk.code}`, code: sk.code, label, score, kindLabel: 'Compétence', kindCls: '' });
  }
  for (const ss of Object.values(DATA.softSkills)) {
    const label = pick(ss.title, currentLang) || '';
    const score = matchScore(label, q);
    if (score !== -1) results.push({ nav: `#/competence/soft/${ss.code}`, code: ss.code, label, score, kindLabel: 'Soft skill', kindCls: 'soft' });
  }
  for (const ds of Object.values(DATA.digitalSkills)) {
    const label = pick(ds.title, currentLang) || '';
    const score = matchScore(label, q);
    if (score !== -1) results.push({ nav: `#/competence/digital/${ds.code}`, code: ds.code, label, score, kindLabel: 'Digital skill', kindCls: 'digital' });
  }
  results.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label));
  renderResultList(container, results.slice(0, 40));
}

function renderResultList(container, items) {
  if (items.length === 0) { container.innerHTML = '<div class="search-result-item">Aucun résultat</div>'; return; }
  container.innerHTML = items.map((it) => `
    <div class="search-result-item" data-nav="${esc(it.nav)}">
      <span class="code">${esc(it.code)}</span>
      <span>${esc(it.label)}${it.sub ? ` <span style="color:var(--muted);font-size:12px;">(${esc(it.sub)})</span>` : ''}</span>
      ${it.kindLabel ? `<span class="kind ${it.kindCls}">${esc(it.kindLabel)}</span>` : ''}
    </div>
  `).join('');
  container.querySelectorAll('[data-nav]').forEach((n) => n.addEventListener('click', () => navigate(n.dataset.nav)));
}

// ---------- occupation page ----------

function renderOccupationPage(opCode) {
  const op = DATA.occupations[opCode];
  if (!op) return el(`<div><p>Métier introuvable : ${esc(opCode)}</p></div>`);

  const title = pick(op.title, currentLang) || opCode;
  const otherTitle = otherLangTitle(op.title, currentLang);

  const allTitles = Object.entries(op.title).map(([k, v]) => `<dt>Titre (${k.toUpperCase()})</dt><dd>${esc(v)}</dd>`).join('');

  const identBlock = `
    <section class="block">
      <h3>Identification</h3>
      <dl class="kv-grid">
        <dt>Code</dt><dd>${esc(op.id)}</dd>
        <dt>UUID</dt><dd style="font-family:ui-monospace,monospace;font-size:12px;">${esc(op.uuid)}</dd>
        ${allTitles}
        ${op.lastModified ? `<dt>Dernière modification</dt><dd>${esc(fmtDate(op.lastModified))}</dd>` : ''}
        ${op.lastPublished ? `<dt>Dernière publication</dt><dd>${esc(fmtDate(op.lastPublished))}</dd>` : ''}
      </dl>
    </section>
  `;

  const altNamesBlock = block('Noms alternatifs', op.altNames.length, `
    <table class="simple">
      <thead><tr><th>Code</th><th>Langue</th><th>Nom</th></tr></thead>
      <tbody>${op.altNames.map((a) => `<tr><td>${esc(a.code)}</td><td>${esc(a.language)}</td><td>${esc(a.title)}</td></tr>`).join('')}</tbody>
    </table>
  `);

  const descParts = Object.entries(op.description).map(([k, v]) => `<div><span class="lang-label">${k}</span>${esc(v)}</div>`).join('');
  const descBlock = Object.keys(op.description).length ? `<section class="block"><h3>Description</h3><div class="text-block">${descParts}</div></section>` : '';

  const wcParts = Object.entries(op.workingContext).map(([k, v]) => `<div><span class="lang-label">${k}</span>${esc(v)}</div>`).join('');
  const wcBlock = Object.keys(op.workingContext).length ? `<section class="block"><h3>Contexte de travail</h3><div class="text-block">${wcParts}</div></section>` : '';

  const iscoBlock = block('Codes ISCO', op.iscoCodes.length, `
    <div class="chips">${op.iscoCodes.map((c) => `<span class="chip static">${esc(c.type)}: ${esc(c.value)}</span>`).join('')}</div>
  `);

  const sectorsBlock = block('Secteurs économiques', op.econSectors.length, `
    <div class="chips">${op.econSectors.map((s) => `<span class="chip static"><span class="code">${esc(s.code)}</span>${esc(pick(s.title, currentLang))}</span>`).join('')}</div>
  `);

  const areasBlock = block("Domaines d'intérêt", op.areasOfInterest.length, `
    <div class="chips">${op.areasOfInterest.map((s) => `<span class="chip static"><span class="code">${esc(s.code)}</span>${esc(pick(s.title, currentLang))}</span>`).join('')}</div>
  `);

  const polBlock = block("Preuves d'apprentissage", op.proofsOfLearning.length, `
    <table class="simple">
      <thead><tr><th>Code</th><th>Libellé</th></tr></thead>
      <tbody>${op.proofsOfLearning.map((p) => `<tr><td>${esc(p.code)}</td><td>${esc(pick(p.title, currentLang))}</td></tr>`).join('')}</tbody>
    </table>
  `);

  const softBlock = block('Soft skills', op.softSkills.length, `<div class="chips">${op.softSkills.map(softChip).join('')}</div>`);
  const digitalBlock = block('Digital skills', op.digitalSkills.length, `<div class="chips">${op.digitalSkills.map(digitalChip).join('')}</div>`);

  function competenceCards(cpCodes, badgeCls, badgeLabel) {
    return cpCodes.map((cpCode) => {
      const cp = DATA.competences[cpCode];
      if (!cp) return '';
      const skTitle = pick(cp.title, currentLang) || cp.skillCode;
      const totalOther = new Set([...cp.essentialFor, ...cp.optionalFor]).size - 1;
      return `
        <div class="competence-card">
          <div class="cc-meta">${esc(cpCode)} · compétence ${esc(cp.skillCode || '')} <span class="badge ${badgeCls}">${badgeLabel}</span></div>
          <div class="cc-title" data-nav="#/competence/skill/${esc(cp.skillCode)}">${esc(skTitle)}</div>
          ${totalOther > 0 ? `<div class="empty-note">Partagée avec ${totalOther} autre(s) métier(s)</div>` : ''}
          ${cp.knowledge.length ? `<div class="subgroup"><div class="label">Connaissances (${cp.knowledge.length})</div><ul>${cp.knowledge.map((k) => `<li>${esc(pick(k.title, currentLang))}</li>`).join('')}</ul></div>` : ''}
          ${cp.behavioral.length ? `<div class="subgroup"><div class="label">Indicateurs comportementaux (${cp.behavioral.length})</div><ul>${cp.behavioral.map((b) => `<li>${esc(pick(b.title, currentLang))}</li>`).join('')}</ul></div>` : ''}
        </div>
      `;
    }).join('');
  }

  const essentialBlock = block('Compétences essentielles', op.essentialCompetenceCPs.length, competenceCards(op.essentialCompetenceCPs, 'essential', 'essentielle'));
  const optionalBlock = block('Compétences optionnelles', op.optionalCompetenceCPs.length, competenceCards(op.optionalCompetenceCPs, 'optional', 'optionnelle'));

  const csetBlock = block('Ensembles de compétences', op.competenceSets.length, op.competenceSets.map((csCode) => {
    const cset = DATA.competenceSets[csCode];
    if (!cset) return '';
    const name = pick(cset.name, currentLang) || csCode;
    const dis = pick(cset.disambiguator, currentLang);
    const otherCount = cset.occupations.length - 1;
    return `
      <div class="competence-card">
        <div class="cc-meta">${esc(csCode)}</div>
        <div class="cc-title" style="cursor:default;color:var(--text);">${esc(name)}${dis ? ` <span style="color:var(--muted);font-weight:400;">(${esc(dis)})</span>` : ''}</div>
        ${otherCount > 0 ? `<div class="empty-note">Utilisé aussi par ${otherCount} autre(s) métier(s)</div>` : ''}
        <div class="subgroup"><div class="chips">${cset.items.map((it) => it.type === 'SKILL' && DATA.skills[it.code] ? skillChip(it.code) : `<span class="chip static"><span class="code">${esc(it.code)}</span>${esc(pick(it.title, currentLang))}</span>`).join('')}</div></div>
      </div>
    `;
  }).join(''));

  const wrap = el(`
    <div>
      <div class="breadcrumb"><a data-nav="#/">Accueil</a> / Métier</div>
      <div class="detail-header">
        <span class="code-tag">${esc(op.id)}</span>
        <h2>${esc(title)}</h2>
        ${otherTitle ? `<div class="subtitle">${esc(otherTitle)}</div>` : ''}
      </div>
      ${identBlock}
      ${altNamesBlock}
      ${descBlock}
      ${wcBlock}
      ${iscoBlock}
      ${sectorsBlock}
      ${areasBlock}
      ${polBlock}
      ${softBlock}
      ${digitalBlock}
      ${essentialBlock}
      ${optionalBlock}
      ${csetBlock}
    </div>
  `);
  return wrap;
}

// ---------- skill (compétence) page ----------

function renderSkillPage(skillCode) {
  const sk = DATA.skills[skillCode];
  if (!sk) return el(`<div><p>Compétence introuvable : ${esc(skillCode)}</p></div>`);
  const title = pick(sk.title, currentLang) || skillCode;

  const instancesHtml = sk.competenceCPs.map((cpCode) => {
    const cp = DATA.competences[cpCode];
    if (!cp) return '';
    return `
      <div class="competence-card">
        <div class="cc-meta">${esc(cpCode)}</div>
        ${cp.knowledge.length ? `<div class="subgroup"><div class="label">Connaissances (${cp.knowledge.length})</div><ul>${cp.knowledge.map((k) => `<li>${esc(pick(k.title, currentLang))}</li>`).join('')}</ul></div>` : ''}
        ${cp.behavioral.length ? `<div class="subgroup"><div class="label">Indicateurs comportementaux (${cp.behavioral.length})</div><ul>${cp.behavioral.map((b) => `<li>${esc(pick(b.title, currentLang))}</li>`).join('')}</ul></div>` : ''}
        ${cp.essentialFor.length ? `<div class="subgroup"><div class="label">Essentielle pour (${cp.essentialFor.length})</div><div class="occ-list">${cp.essentialFor.map(occChip).join('')}</div></div>` : ''}
        ${cp.optionalFor.length ? `<div class="subgroup"><div class="label">Optionnelle pour (${cp.optionalFor.length})</div><div class="occ-list">${cp.optionalFor.map(occChip).join('')}</div></div>` : ''}
      </div>
    `;
  }).join('');

  const totalEssential = new Set(sk.competenceCPs.flatMap((c) => DATA.competences[c]?.essentialFor || [])).size;
  const totalOptional = new Set(sk.competenceCPs.flatMap((c) => DATA.competences[c]?.optionalFor || [])).size;

  const instancesBlock = block(
    sk.competenceCPs.length > 1 ? 'Déclinaisons de cette compétence' : 'Détail de la compétence',
    sk.competenceCPs.length,
    instancesHtml,
  );

  const csetBlock = block('Ensembles de compétences liés', sk.competenceSets.length, sk.competenceSets.map((csCode) => {
    const cset = DATA.competenceSets[csCode];
    if (!cset) return '';
    const name = pick(cset.name, currentLang) || csCode;
    return `
      <div class="competence-card">
        <div class="cc-meta">${esc(csCode)}</div>
        <div class="cc-title" style="cursor:default;color:var(--text);">${esc(name)}</div>
        <div class="subgroup"><div class="label">Métiers concernés (${cset.occupations.length})</div><div class="occ-list">${cset.occupations.map(occChip).join('')}</div></div>
      </div>
    `;
  }).join(''));

  const wrap = el(`
    <div>
      <div class="breadcrumb"><a data-nav="#/">Accueil</a> / Compétence</div>
      <div class="detail-header">
        <span class="code-tag">${esc(sk.code)}</span>
        <h2>${esc(title)}</h2>
        <div class="subtitle">${totalEssential} métier(s) — essentielle · ${totalOptional} métier(s) — optionnelle</div>
      </div>
      ${instancesBlock}
      ${csetBlock}
    </div>
  `);
  return wrap;
}

// ---------- soft / digital skill page ----------

function renderSoftDigitalPage(kind, code) {
  const store = kind === 'soft' ? DATA.softSkills : DATA.digitalSkills;
  const item = store[code];
  if (!item) return el(`<div><p>Compétence introuvable : ${esc(code)}</p></div>`);
  const title = pick(item.title, currentLang) || code;
  const kindLabel = kind === 'soft' ? 'Soft skill' : 'Digital skill';
  const kindCls = kind === 'soft' ? 'soft' : 'digital';

  const wrap = el(`
    <div>
      <div class="breadcrumb"><a data-nav="#/">Accueil</a> / Compétence</div>
      <div class="detail-header">
        <span class="code-tag">${esc(item.code)}</span> <span class="kind ${kindCls}">${kindLabel}</span>
        <h2>${esc(title)}</h2>
      </div>
      <section class="block">
        <h3>Métiers concernés <span class="count">${item.occupations.length}</span></h3>
        <div class="occ-list">${item.occupations.map(occChip).join('')}</div>
      </section>
    </div>
  `);
  return wrap;
}
