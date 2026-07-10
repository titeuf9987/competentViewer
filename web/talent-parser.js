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

function stripMarker(s) {
  return (s || '').replace(/\s*\(M1\)\s*/g, '').trim();
}

function parseTalentWorkbook(workbook, sourceName) {
  const competences = {};
  const familles = {};
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
      dimensions: [],
      texteSource: null,
    };
    if (!familles[familyKey]) familles[familyKey] = { key: familyKey, title: lang(famNl, famFr), competences: [] };
    if (!familles[familyKey].competences.includes(id)) familles[familyKey].competences.push(id);
  }

  // --- Liens niveaux ---
  for (const r of sheetRows(workbook, 'Liens niveaux')) {
    const [id, cFr, cNl, ordre, nivFr, nivNl, marqueur, pageSource] = r;
    if (!competences[id]) continue;
    const levelKey = stripMarker(nivFr);
    competences[id].niveaux.push({ ordre, niveau: lang(nivNl, nivFr), levelKey, marqueur: nz(marqueur), pageSource });
    if (!niveaux[levelKey]) niveaux[levelKey] = { key: levelKey, competences: [] };
    if (!niveaux[levelKey].competences.some((c) => c.id === id)) {
      niveaux[levelKey].competences.push({ id, marqueur: nz(marqueur), pageSource });
    }
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
  }

  return {
    meta: {
      generatedFrom: sourceName,
      generatedAt: new Date().toISOString(),
      competenceCount: Object.keys(competences).length,
      familyCount: Object.keys(familles).length,
      levelCount: Object.keys(niveaux).length,
    },
    competences,
    familles,
    niveaux,
  };
}
