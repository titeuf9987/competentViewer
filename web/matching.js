// Bridges the two otherwise-independent tabs: a curated list of matches
// between Competent soft skills and Talent compétences (by French title),
// each tagged with a confidence ("exact" / "proche" / "associé"). Loaded
// once, in the background, independently of which tab is active.
let MATCHES = null;
let matchesPromise = null;

function normalizeTitle(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[’‘']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMatchingCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const list = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';');
    const competentTitle = (parts[0] || '').trim();
    const talentTitle = (parts[1] || '').trim();
    const relation = (parts[2] || '').trim();
    if (!competentTitle || !talentTitle) continue;
    list.push({ competentTitle, talentTitle, relation });
  }
  const byCompetent = {};
  const byTalent = {};
  for (const m of list) {
    const ck = normalizeTitle(m.competentTitle);
    const tk = normalizeTitle(m.talentTitle);
    if (!byCompetent[ck]) byCompetent[ck] = [];
    byCompetent[ck].push(m);
    if (!byTalent[tk]) byTalent[tk] = [];
    byTalent[tk].push(m);
  }
  return { list, byCompetent, byTalent };
}

function ensureMatchesLoaded() {
  if (matchesPromise) return matchesPromise;
  matchesPromise = fetch('data/matching.csv', { cache: 'no-store' })
    .then((res) => {
      if (!res.ok) throw new Error('matching.csv introuvable');
      return res.text();
    })
    .then((text) => { MATCHES = parseMatchingCsv(text); })
    .catch((err) => {
      console.error('Impossible de charger la correspondance Competent/Talent :', err);
      MATCHES = { list: [], byCompetent: {}, byTalent: {} };
    });
  return matchesPromise;
}

function matchesForCompetentTitle(title) {
  if (!MATCHES) return [];
  return MATCHES.byCompetent[normalizeTitle(title)] || [];
}

function matchesForTalentTitle(title) {
  if (!MATCHES) return [];
  return MATCHES.byTalent[normalizeTitle(title)] || [];
}
