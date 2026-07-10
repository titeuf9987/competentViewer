// Turns the "Référentiel de compétences bilingue Talent Brussels" export into
// the in-memory data model consumed by app-talent.js. Runs entirely in the
// browser. Reuses the generic helpers (findSheetName, sheetRows, nz, lang)
// defined in parser.js — this file has no relationship to the Competent
// (VDAB) dataset otherwise.

function slugify(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function findSheetNameOptional(workbook, prefix) {
  return workbook.SheetNames.find((n) => n.toLowerCase().startsWith(prefix.toLowerCase())) || null;
}

const LEVEL_RANK = { D: 0, C: 1, B: 2, A: 3, A1: 4, A2: 5, A3: 6, 'A3+': 7 };
function levelRank(niveau) {
  return LEVEL_RANK[niveau] !== undefined ? LEVEL_RANK[niveau] : 99;
}

function parseTalentWorkbook(workbook, sourceName) {
  const competences = {};
  const familles = {};
  const profils = {};
  const niveaux = {};

  // --- Compétences (base) ---
  for (const r of sheetRows(workbook, 'Compétences')) {
    const [id, page, famFr, famNl, cFr, cNl, dFr, dNl, marqueur, nivFr, nivNl, srcFr, srcNl] = r;
    const familyKey = slugify(famFr);
    competences[id] = {
      id,
      page,
      familyKey,
      famille: lang(famNl, famFr),
      title: lang(cNl, cFr),
      description: lang(dNl, dFr),
      marqueur: nz(marqueur),
      niveauxRaw: lang(nivNl, nivFr),
      source: lang(srcNl, srcFr),
      niveaux: [],
      profilNiveaux: [],
      dimensions: [],
      texteSource: null,
    };
    if (!familles[familyKey]) familles[familyKey] = { key: familyKey, title: lang(famNl, famFr), competences: [] };
    if (!familles[familyKey].competences.includes(id)) familles[familyKey].competences.push(id);
  }

  // --- Liens niveaux ---
  // Kept as raw, informational per-compétence detail only (Ordre, Niveau,
  // Marqueur, Page) — NOT used to build any browsable "niveau" entity. The
  // actual niveau/compétence link lives in "Compétences par profil" below.
  for (const r of sheetRows(workbook, 'Liens niveaux')) {
    const [id, cFr, cNl, ordre, nivFr, nivNl, marqueur, pageSource] = r;
    if (!competences[id]) continue;
    competences[id].niveaux.push({ ordre, niveau: lang(nivNl, nivFr), marqueur: nz(marqueur), pageSource });
  }

  // --- Compétences par profil ---
  // The authoritative niveau <-> compétence link: each row is one (profil,
  // niveau, compétence) requirement. A niveau is identified by profil+niveau
  // (e.g. "Manager – A2"), not by letter+ordre — the same letter means
  // different things for different profils (Manager's "A" grade is itself
  // split into A1/A2/A3/A3+, while other profils just have a plain "A").
  const profilSheetName = findSheetNameOptional(workbook, 'Compétences par profil');
  if (profilSheetName) {
    for (const r of sheetRows(workbook, 'Compétences par profil')) {
      const [profilFr, profilNl, niveau, famFr, famNl, cFr, cNl, ordreRef, requiseFr, requiseNl, source] = r;
      const id = `C${String(ordreRef).padStart(2, '0')}`;
      if (!competences[id]) continue;
      const profilKey = slugify(profilFr);
      if (!profils[profilKey]) profils[profilKey] = { key: profilKey, title: lang(profilNl, profilFr), niveaux: [] };
      const levelKey = `${profilKey}__${niveau}`;
      if (!profils[profilKey].niveaux.includes(levelKey)) profils[profilKey].niveaux.push(levelKey);
      if (!niveaux[levelKey]) {
        niveaux[levelKey] = {
          key: levelKey,
          profilKey,
          niveau,
          label: { fr: `${profilFr} – ${niveau}`, nl: `${profilNl} – ${niveau}` },
          source: nz(source),
          competences: [],
        };
      }
      if (!niveaux[levelKey].competences.includes(id)) niveaux[levelKey].competences.push(id);
      if (!competences[id].profilNiveaux.some((p) => p.levelKey === levelKey)) {
        competences[id].profilNiveaux.push({ levelKey, profilKey, niveau, requis: lang(requiseNl, requiseFr) });
      }
    }
    for (const p of Object.values(profils)) p.niveaux.sort((a, b) => levelRank(niveaux[a].niveau) - levelRank(niveaux[b].niveau));
  }

  // --- Dimensions (incl. DigComp rows) ---
  for (const r of sheetRows(workbook, 'Dimensions')) {
    const [id, cFr, cNl, ordre, type, symbole, digCompCode, dimFr, dimNl, descFr, descNl, pageSource] = r;
    if (!competences[id]) continue;
    competences[id].dimensions.push({
      ordre, type, symbole, digCompCode: nz(digCompCode),
      title: lang(dimNl, dimFr), description: lang(descNl, descFr), pageSource,
    });
  }

  // --- Texte source (joined on Page) ---
  const byPage = {};
  for (const c of Object.values(competences)) byPage[c.page] = c;
  for (const r of sheetRows(workbook, 'Texte source')) {
    const [page, titreFr, texteFr, titreNl, texteNl] = r;
    const c = byPage[page];
    if (!c) continue;
    c.texteSource = { titre: lang(titreNl, titreFr), texte: lang(texteNl, texteFr) };
  }

  for (const c of Object.values(competences)) {
    c.niveaux.sort((a, b) => a.ordre - b.ordre);
    c.dimensions.sort((a, b) => a.ordre - b.ordre);
    c.profilNiveaux.sort((a, b) => levelRank(a.niveau) - levelRank(b.niveau));
  }

  return {
    meta: {
      generatedFrom: sourceName,
      generatedAt: new Date().toISOString(),
      competenceCount: Object.keys(competences).length,
      familyCount: Object.keys(familles).length,
      profilCount: Object.keys(profils).length,
      levelCount: Object.keys(niveaux).length,
    },
    competences,
    familles,
    profils,
    niveaux,
  };
}
