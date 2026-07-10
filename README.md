# Competent Viewer

Un visualiseur pour les exports Excel de [Competent (VDAB)](https://extranet.vdab.be/competent) —
la base de données belge des métiers et compétences.

Deux points d'entrée pour explorer les liens entre données :

- **Par métier** : toutes les infos d'un métier sur une seule page (noms alternatifs,
  description, contexte de travail, codes ISCO, secteurs, domaines d'intérêt, preuves
  d'apprentissage, soft skills, digital skills, compétences essentielles/optionnelles
  avec leurs connaissances et indicateurs comportementaux, ensembles de compétences).
- **Par compétence** : une compétence, un soft skill ou un digital skill, avec la liste
  complète des métiers concernés.

Le viewer lit et interprète le fichier `.xlsx` **dans le navigateur** ; aucune donnée
n'est envoyée où que ce soit. Le classeur `web/data/export.xlsx` est chargé
automatiquement au démarrage. Pour explorer un autre export, cliquez sur l'icône
rafraîchir (↻) en haut de la page et choisissez un autre fichier `.xlsx` — le
remplacement ne vaut que pour la session en cours et ne modifie pas le fichier par
défaut. Pour changer le fichier par défaut lui-même, remplacez `web/data/export.xlsx`.

## Utilisation

- **En local** : ouvrez `web/index.html` dans un navigateur (double-clic suffit). Le
  chargement automatique du fichier par défaut nécessite d'être servi en http (voir
  ci-dessous) — en `file://`, l'écran de dépôt de fichier s'affiche directement.
- **Servi (recommandé)** : `npm start` (voir `server.js`) lance un petit serveur Node
  qui sert `web/` sur `http://localhost:3000` (port configurable via `PORT`), avec le
  chargement automatique de `web/data/export.xlsx`.

Le fichier attendu est l'export standard Competent, avec les onglets `Occupational
Profiles`, `Occ.Prof - Alt.Names`, `Occ.Prof - ProofsOfLearning`, `Occ.Prof - Codes`,
`Occ.Prof - Econ.Sectors`, `Occ.Prof - Soft Skills`, `Occ.Prof - Digital Skills`,
`Occ.Prof - Essential Competence`, `Occ.Prof - Optional Competences`, `Occ.Prof - Areas
of Interest`, `Occ.Prof - Competentiesets` (les numéros de version dans les noms
d'onglets, ex. `3.25`, peuvent varier d'un export à l'autre : la lecture se fait par
préfixe de nom, donc les futures versions du fichier passent sans modification du code).

## Structure

- `web/data/export.xlsx` — export Competent chargé par défaut au démarrage.
- `web/index.html`, `web/style.css` — page et mise en forme.
- `web/parser.js` — transforme les lignes du classeur Excel en un modèle de données
  reliant métiers, compétences (essentielles/optionnelles), soft skills, digital
  skills et ensembles de compétences.
- `web/app.js` — recherche, navigation et rendu des pages ; charge `web/data/export.xlsx`
  au démarrage et gère le rechargement via l'icône rafraîchir.
- `web/vendor/xlsx.full.min.js` — [SheetJS](https://sheetjs.com/) (licence Apache 2.0,
  voir `web/vendor/LICENSE.xlsx.txt`), utilisé pour lire le fichier Excel côté client.
- `server.js`, `package.json` — serveur statique Node minimal (pour l'hébergement, ex.
  Railway/Railpack).

## Notes

- La langue d'affichage (FR/NL) se change en haut à droite ; les champs manquants dans
  la langue choisie retombent automatiquement sur l'autre langue disponible.
- Recharger la page revient au fichier par défaut (rien n'est persisté côté navigateur) ;
  un fichier chargé via l'icône rafraîchir ne vaut que pour la session en cours.
