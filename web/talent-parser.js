// Turns the "Référentiel de compétences bilingue Talent Brussels" export into
// the in-memory data model consumed by app-talent.js. Runs entirely in the
// browser. Reuses the generic helpers (findSheetName, sheetRows, nz, lang)
// defined in parser.js — this file has no relationship to the Competent
// (VDAB) dataset otherwise.
//
// Schema (as of the "corrigé" export): a Famille groups Thèmes (C01..C40,
// the former "Compétences"); each Thème breaks down into several granular
// Compétences (C01-01, C01-02..., the former "Dimensions"); each Compétence
// carries its own niveau/profil requirements.

function slugify(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function findSheetNameOptional(workbook, prefix) {
  const p = prefix.toLowerCase();
  const exact = workbook.SheetNames.find((n) => n.toLowerCase() === p);
  return exact || workbook.SheetNames.find((n) => n.toLowerCase().startsWith(p)) || null;
}

const LEVEL_RANK = { D: 0, C: 1, B: 2, A: 3, A1: 4, A2: 5, A3: 6, 'A3+': 7 };
function levelRank(niveau) {
  return LEVEL_RANK[niveau] !== undefined ? LEVEL_RANK[niveau] : 99;
}

function parseTalentWorkbook(workbook, sourceName) {
  const familles = {};
  const themes = {};
  const competences = {};
  const profils = {};
  const niveaux = {};

  // --- Thèmes (base, formerly "Compétences") ---
  for (const r of sheetRows(workbook, 'Thèmes')) {
    const [id, page, famFr, famNl, tFr, tNl, dFr, dNl, marqueur, nivFr, nivNl, srcFr, srcNl] = r;
    const familyKey = slugify(famFr);
    themes[id] = {
      id,
      page,
      familyKey,
      famille: lang(famNl, famFr),
      title: lang(tNl, tFr),
      description: lang(dNl, dFr),
      marqueur: nz(marqueur),
      niveauxRaw: lang(nivNl, nivFr),
      source: lang(srcNl, srcFr),
      niveaux: [],
      competences: [],
      digitalCompetences: [],
    };
    if (!familles[familyKey]) familles[familyKey] = { key: familyKey, title: lang(famNl, famFr), themes: [] };
    if (!familles[familyKey].themes.includes(id)) familles[familyKey].themes.push(id);
  }

  // --- Compétences (granular, formerly "Dimensions") ---
  for (const r of sheetRows(workbook, 'Compétences')) {
    const [compId, themeId, famFr, famNl, tFr, tNl, cFr, cNl, dFr, dNl, symbole, pageSource] = r;
    if (!themes[themeId]) continue;
    competences[compId] = {
      id: compId,
      themeKey: themeId,
      famille: lang(famNl, famFr),
      theme: lang(tNl, tFr),
      title: lang(cNl, cFr),
      description: lang(dNl, dFr),
      symbole,
      pageSource,
      niveaux: [],
      profilNiveaux: [],
    };
    if (!themes[themeId].competences.includes(compId)) themes[themeId].competences.push(compId);
  }

  // --- Compétences numériques (DigComp, linked to Thème) ---
  for (const r of sheetRows(workbook, 'Compétences numériques')) {
    const [themeId, famFr, famNl, tFr, tNl, digCompCode, cFr, cNl, pageSource] = r;
    if (!themes[themeId]) continue;
    themes[themeId].digitalCompetences.push({ digCompCode: nz(digCompCode), title: lang(cNl, cFr), pageSource });
  }

  // --- Liens thèmes-niveaux ---
  // Kept as raw, informational per-thème detail only (Ordre, Niveau,
  // Marqueur, Page) — NOT used to build any browsable "niveau" entity.
  for (const r of sheetRows(workbook, 'Liens thèmes-niveaux')) {
    const [themeId, tFr, tNl, ordre, nivFr, nivNl, marqueur, pageSource] = r;
    if (!themes[themeId]) continue;
    themes[themeId].niveaux.push({ ordre, niveau: lang(nivNl, nivFr), marqueur: nz(marqueur), pageSource });
  }

  // --- Compétences par niveau ---
  // Same idea as above but at the granular compétence level — also purely
  // informational, shown on the compétence page.
  for (const r of sheetRows(workbook, 'Compétences par niveau')) {
    const [compId, cFr, cNl, themeId, tFr, tNl, nivFr, nivNl, marqueur, pageSource] = r;
    if (!competences[compId]) continue;
    competences[compId].niveaux.push({ niveau: lang(nivNl, nivFr), marqueur: nz(marqueur), pageSource });
  }

  // --- Profils-niveaux-compétences ---
  // The authoritative niveau <-> compétence link, joined directly on "ID
  // compétence" (no reconstruction needed). A niveau is identified by
  // profil+niveau (e.g. "Manager – A2"), not by letter alone — the same
  // letter means different things for different profils (Manager's "A"
  // grade is itself split into A1/A2/A3/A3+, other profils just have a
  // plain "A").
  const profilSheetName = findSheetNameOptional(workbook, 'Profils-niveaux-compétences');
  if (profilSheetName) {
    for (const r of sheetRows(workbook, 'Profils-niveaux-compétences')) {
      const [pnFr, pnNl, profilFr, profilNl, niveau, famFr, famNl, themeId, tFr, tNl, compId] = r;
      if (!competences[compId]) continue;
      const profilKey = slugify(profilFr);
      if (!profils[profilKey]) profils[profilKey] = { key: profilKey, title: lang(profilNl, profilFr), niveaux: [] };
      const levelKey = `${profilKey}__${niveau}`;
      if (!profils[profilKey].niveaux.includes(levelKey)) profils[profilKey].niveaux.push(levelKey);
      if (!niveaux[levelKey]) {
        niveaux[levelKey] = {
          key: levelKey, profilKey, niveau,
          label: { fr: nz(pnFr) || `${profilFr} – ${niveau}`, nl: nz(pnNl) || `${profilNl} – ${niveau}` },
          competences: [],
        };
      }
      if (!niveaux[levelKey].competences.includes(compId)) niveaux[levelKey].competences.push(compId);
      if (!competences[compId].profilNiveaux.some((p) => p.levelKey === levelKey)) {
        competences[compId].profilNiveaux.push({ levelKey, profilKey, niveau });
      }
    }
    for (const p of Object.values(profils)) p.niveaux.sort((a, b) => levelRank(niveaux[a].niveau) - levelRank(niveaux[b].niveau));
  }

  for (const t of Object.values(themes)) t.niveaux.sort((a, b) => a.ordre - b.ordre);
  for (const c of Object.values(competences)) c.profilNiveaux.sort((a, b) => levelRank(a.niveau) - levelRank(b.niveau));

  return {
    meta: {
      generatedFrom: sourceName,
      generatedAt: new Date().toISOString(),
      themeCount: Object.keys(themes).length,
      competenceCount: Object.keys(competences).length,
      familyCount: Object.keys(familles).length,
      profilCount: Object.keys(profils).length,
      levelCount: Object.keys(niveaux).length,
    },
    familles,
    themes,
    competences,
    profils,
    niveaux,
  };
}
