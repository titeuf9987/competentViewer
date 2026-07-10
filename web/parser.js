// Turns a Competent (VDAB) occupational-profiles Excel export into the
// in-memory data model consumed by app.js. Runs entirely in the browser —
// nothing about a specific export is baked into this file.

function findSheetName(workbook, prefix) {
  const name = workbook.SheetNames.find((n) => n.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!name) throw new Error(`Onglet introuvable pour le préfixe "${prefix}". Onglets présents: ${workbook.SheetNames.join(', ')}`);
  return name;
}

function sheetRows(workbook, prefix) {
  const name = findSheetName(workbook, prefix);
  const ws = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  return rows.slice(1).filter((r) => r.some((v) => v !== null && v !== undefined && v !== ''));
}

function nz(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  if (v instanceof Date) return v.toISOString();
  return v;
}

function lang(nl, fr, en, de) {
  const d = {};
  const n1 = nz(nl), n2 = nz(fr), n3 = nz(en), n4 = nz(de);
  if (n1 !== null) d.nl = n1;
  if (n2 !== null) d.fr = n2;
  if (n3 !== null) d.en = n3;
  if (n4 !== null) d.de = n4;
  return d;
}

function sameItem(a, b) {
  return a.code === b.code;
}

function parseCompetentWorkbook(workbook, sourceName) {
  const occupations = {};
  const skills = {};
  const competences = {};
  const softSkills = {};
  const digitalSkills = {};
  const competenceSets = {};

  // --- Occupational Profiles (base) ---
  for (const r of sheetRows(workbook, 'Occupational Profiles')) {
    const [uuid, code, tNl, tFr, tEn, tDe, dNl, dFr, dEn, dDe, wcNl, wcFr, wcEn, wcDe, lastMod, lastPub] = r;
    occupations[code] = {
      id: code,
      uuid,
      title: lang(tNl, tFr, tEn, tDe),
      description: lang(dNl, dFr, dEn, dDe),
      workingContext: lang(wcNl, wcFr, wcEn, wcDe),
      lastModified: nz(lastMod),
      lastPublished: nz(lastPub),
      altNames: [],
      proofsOfLearning: [],
      iscoCodes: [],
      econSectors: [],
      areasOfInterest: [],
      softSkills: [],
      digitalSkills: [],
      essentialCompetenceCPs: [],
      optionalCompetenceCPs: [],
      competenceSets: [],
    };
  }

  // --- Alternative Names ---
  for (const r of sheetRows(workbook, 'Occ.Prof - Alt.Names')) {
    const [occId, opCode, opTNl, opTFr, anId, anCode, language, title] = r;
    if (!occupations[opCode]) continue;
    occupations[opCode].altNames.push({ id: anId, code: anCode, language, title: nz(title) });
  }

  // --- Proofs of Learning ---
  for (const r of sheetRows(workbook, 'Occ.Prof - ProofsOfLearning')) {
    const [occId, opCode, opTNl, opTFr, polId, polCode, polNl, polFr] = r;
    if (!occupations[opCode]) continue;
    occupations[opCode].proofsOfLearning.push({ id: polId, code: polCode, title: lang(polNl, polFr) });
  }

  // --- Codes (ISCO) ---
  for (const r of sheetRows(workbook, 'Occ.Prof - Codes')) {
    const [occId, opCode, opTNl, opTFr, type, value] = r;
    if (!occupations[opCode]) continue;
    occupations[opCode].iscoCodes.push({ type, value });
  }

  // --- Economic Sectors ---
  for (const r of sheetRows(workbook, 'Occ.Prof - Econ.Sectors')) {
    const [occId, opCode, opTNl, opTFr, esId, esCode, esNl, esFr] = r;
    if (!occupations[opCode]) continue;
    occupations[opCode].econSectors.push({ id: esId, code: esCode, title: lang(esNl, esFr) });
  }

  // --- Areas of Interest ---
  for (const r of sheetRows(workbook, 'Occ.Prof - Areas of Interest')) {
    const [occId, opCode, opTNl, opTFr, aiId, aiCode, aiNl, aiFr] = r;
    if (!occupations[opCode]) continue;
    occupations[opCode].areasOfInterest.push({ id: aiId, code: aiCode, title: lang(aiNl, aiFr) });
  }

  // --- Soft Skills ---
  for (const r of sheetRows(workbook, 'Occ.Prof - Soft Skills')) {
    const [occId, opCode, opTNl, opTFr, ssId, ssCode, ssTitleId, ssNl, ssFr] = r;
    if (!occupations[opCode]) continue;
    if (!softSkills[ssCode]) softSkills[ssCode] = { code: ssCode, title: lang(ssNl, ssFr), occupations: [] };
    if (!softSkills[ssCode].occupations.includes(opCode)) softSkills[ssCode].occupations.push(opCode);
    if (!occupations[opCode].softSkills.includes(ssCode)) occupations[opCode].softSkills.push(ssCode);
  }

  // --- Digital Skills ---
  for (const r of sheetRows(workbook, 'Occ.Prof - Digital Skills')) {
    const [occId, opCode, opTNl, opTFr, dsId, dsCode, dsTitleId, dsNl, dsFr] = r;
    if (!occupations[opCode]) continue;
    if (!digitalSkills[dsCode]) digitalSkills[dsCode] = { code: dsCode, title: lang(dsNl, dsFr), occupations: [] };
    if (!digitalSkills[dsCode].occupations.includes(opCode)) digitalSkills[dsCode].occupations.push(opCode);
    if (!occupations[opCode].digitalSkills.includes(dsCode)) occupations[opCode].digitalSkills.push(dsCode);
  }

  // --- Essential / Optional Competences ---
  // A competence (CP-xxx) = one skill (SK-xxx) + its knowledge elements and
  // behavioral indicators. The same CP-xxx recurs unchanged across many
  // occupations (essential for some, optional for others), so it's kept as a
  // single record and occupations/skills reference it by code.
  function ingestCompetences(prefix, bucketKey, occBucketKey) {
    for (const r of sheetRows(workbook, prefix)) {
      const [occId, opCode, opTNl, opTFr, competenceId, cpCode, blockType, blockId, blockCode, blockNl, blockFr] = r;
      if (!occupations[opCode]) continue;
      if (!competences[cpCode]) {
        competences[cpCode] = {
          cpCode, competenceId, skillCode: null, title: {},
          knowledge: [], behavioral: [], essentialFor: [], optionalFor: [],
        };
      }
      const cp = competences[cpCode];
      if (blockType === 'skill') {
        cp.skillCode = blockCode;
        cp.title = lang(blockNl, blockFr);
      } else if (blockType === 'knowledge') {
        const item = { code: blockCode, title: lang(blockNl, blockFr) };
        if (!cp.knowledge.some((x) => sameItem(x, item))) cp.knowledge.push(item);
      } else if (blockType === 'behavioural indicator') {
        const item = { code: blockCode, title: lang(blockNl, blockFr) };
        if (!cp.behavioral.some((x) => sameItem(x, item))) cp.behavioral.push(item);
      }
      if (!cp[bucketKey].includes(opCode)) cp[bucketKey].push(opCode);
      if (!occupations[opCode][occBucketKey].includes(cpCode)) occupations[opCode][occBucketKey].push(cpCode);
    }
  }
  ingestCompetences('Occ.Prof - Essential Competence', 'essentialFor', 'essentialCompetenceCPs');
  ingestCompetences('Occ.Prof - Optional Competences', 'optionalFor', 'optionalCompetenceCPs');

  for (const [cpCode, cp] of Object.entries(competences)) {
    const skCode = cp.skillCode;
    if (!skCode) continue;
    if (!skills[skCode]) skills[skCode] = { code: skCode, title: {}, competenceCPs: [], competenceSets: [] };
    const sk = skills[skCode];
    if (Object.keys(cp.title).length) sk.title = cp.title;
    if (!sk.competenceCPs.includes(cpCode)) sk.competenceCPs.push(cpCode);
  }

  // --- Competence sets ---
  const csSeenPerOcc = new Set();
  for (const r of sheetRows(workbook, 'Occ.Prof - Competentiesets')) {
    const [occId, opCode, opTNl, opTFr, csetId, csCode, csNl, csFr, disNl, disFr, blockType, blockCode, blockNl, blockFr] = r;
    if (!occupations[opCode]) continue;
    if (!competenceSets[csCode]) {
      competenceSets[csCode] = {
        code: csCode, id: csetId, name: lang(csNl, csFr), disambiguator: lang(disNl, disFr),
        items: [], occupations: [],
      };
    }
    const cset = competenceSets[csCode];
    const item = { type: blockType, code: blockCode, title: lang(blockNl, blockFr) };
    if (!cset.items.some((x) => x.type === item.type && x.code === item.code)) cset.items.push(item);
    if (!cset.occupations.includes(opCode)) cset.occupations.push(opCode);
    const key = `${opCode}|${csCode}`;
    if (!csSeenPerOcc.has(key)) {
      csSeenPerOcc.add(key);
      occupations[opCode].competenceSets.push(csCode);
    }
    if (blockType === 'SKILL' && skills[blockCode] && !skills[blockCode].competenceSets.includes(csCode)) {
      skills[blockCode].competenceSets.push(csCode);
    }
  }

  return {
    meta: {
      generatedFrom: sourceName,
      generatedAt: new Date().toISOString(),
      occupationCount: Object.keys(occupations).length,
      skillCount: Object.keys(skills).length,
      competenceCount: Object.keys(competences).length,
      softSkillCount: Object.keys(softSkills).length,
      digitalSkillCount: Object.keys(digitalSkills).length,
      competenceSetCount: Object.keys(competenceSets).length,
    },
    occupations,
    skills,
    competences,
    softSkills,
    digitalSkills,
    competenceSets,
  };
}
