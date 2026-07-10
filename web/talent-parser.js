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
  // The letter alone (A/B/C/D) is not the actual level: the same letter
  // means a different thing depending on where it sits in a given
  // compétence's ladder (e.g. a 2-rung ladder ending in A ("B, A") is a
  // different level than a 5-rung one ("Indicateurs standards, D, C, B, A")).
  // "Ordre" is that rung position, so the real level id is letter+ordre
  // (A1, A2, A3...), per the reference's own numbering (e.g. "A3"). This
  // does not use the Compétences tab's summary "Niveaux" column at all.
  // The scale is also cumulative: reaching A5 implies A1-A4 too, so the
  // "A5" level's competences are the union of A1..A5 (same for B/C/D).
  const exactByLetterOrdre = {}; // { A: { 1: [{id,marqueur,pageSource}], 2: [...] }, ... }
  for (const r of sheetRows(workbook, 'Liens niveaux')) {
    const [id, cFr, cNl, ordre, nivFr, nivNl, marqueur, pageSource] = r;
    if (!competences[id]) continue;
    const baseLetter = stripMarker(nivFr);
    const isScaled = /^[ABCD]$/.test(baseLetter);
    const levelKey = isScaled ? `${baseLetter}${ordre}` : baseLetter;
    competences[id].niveaux.push({ ordre, niveau: lang(nivNl, nivFr), levelKey, marqueur: nz(marqueur), pageSource });
    const entry = { id, marqueur: nz(marqueur), pageSource, exactLevel: levelKey };
    if (isScaled) {
      if (!exactByLetterOrdre[baseLetter]) exactByLetterOrdre[baseLetter] = {};
      if (!exactByLetterOrdre[baseLetter][ordre]) exactByLetterOrdre[baseLetter][ordre] = [];
      exactByLetterOrdre[baseLetter][ordre].push(entry);
    } else {
      if (!niveaux[levelKey]) niveaux[levelKey] = { key: levelKey, competences: [] };
      if (!niveaux[levelKey].competences.some((c) => c.id === id)) niveaux[levelKey].competences.push(entry);
    }
  }
  for (const letter of Object.keys(exactByLetterOrdre)) {
    const ordres = Object.keys(exactByLetterOrdre[letter]).map(Number).sort((a, b) => a - b);
    for (const n of ordres) {
      const key = `${letter}${n}`;
      const cumulative = [];
      for (const k of ordres) {
        if (k > n) break;
        cumulative.push(...exactByLetterOrdre[letter][k]);
      }
      niveaux[key] = { key, competences: cumulative };
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
