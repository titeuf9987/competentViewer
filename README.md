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

Rien n'est codé en dur : le viewer est une page statique qui lit et interprète le
fichier `.xlsx` **dans le navigateur**, au moment où vous le chargez. Aucune donnée
n'est envoyée où que ce soit.

## Utilisation

Ouvrez `web/index.html` dans un navigateur (double-clic suffit, pas besoin de serveur),
puis glissez-déposez votre export Competent (`.xlsx`) ou choisissez-le via le bouton.

Le fichier attendu est l'export standard Competent, avec les onglets `Occupational
Profiles`, `Occ.Prof - Alt.Names`, `Occ.Prof - ProofsOfLearning`, `Occ.Prof - Codes`,
`Occ.Prof - Econ.Sectors`, `Occ.Prof - Soft Skills`, `Occ.Prof - Digital Skills`,
`Occ.Prof - Essential Competence`, `Occ.Prof - Optional Competences`, `Occ.Prof - Areas
of Interest`, `Occ.Prof - Competentiesets` (les numéros de version dans les noms
d'onglets, ex. `3.25`, peuvent varier d'un export à l'autre : la lecture se fait par
préfixe de nom, donc les futures versions du fichier passent sans modification du code).

## Structure

- `web/index.html`, `web/style.css` — page et mise en forme.
- `web/parser.js` — transforme les lignes du classeur Excel en un modèle de données
  reliant métiers, compétences (essentielles/optionnelles), soft skills, digital
  skills et ensembles de compétences.
- `web/app.js` — recherche, navigation et rendu des pages.
- `web/vendor/xlsx.full.min.js` — [SheetJS](https://sheetjs.com/) (licence Apache 2.0,
  voir `web/vendor/LICENSE.xlsx.txt`), utilisé pour lire le fichier Excel côté client.

## Notes

- La langue d'affichage (FR/NL) se change en haut à droite ; les champs manquants dans
  la langue choisie retombent automatiquement sur l'autre langue disponible.
- Recharger la page oblige à recharger le fichier (rien n'est persisté), puisque le but
  est justement de ne pas figer une version des données dans l'application.
