# Competent Viewer

Un visualiseur pour deux référentiels, chacun dans son propre onglet avec ses propres
données — seules les compétences explicitement mises en correspondance entre les deux
(voir « Correspondance Competent ↔ Talent » plus bas) sont reliées entre les onglets.

## Onglet « Métiers & compétences »

Exports Excel de [Competent (VDAB)](https://extranet.vdab.be/competent) — la base de
données belge des métiers et compétences. Deux points d'entrée :

- **Par métier** : toutes les infos d'un métier sur une seule page (noms alternatifs,
  description, contexte de travail, codes ISCO, secteurs, domaines d'intérêt, preuves
  d'apprentissage, soft skills, digital skills, compétences essentielles/optionnelles,
  ensembles de compétences).
- **Par compétence** : une compétence, un soft skill ou un digital skill, avec la liste
  complète des métiers concernés.

Secteurs économiques et domaines d'intérêt sont eux aussi cliquables et ouvrent leur
propre page (définition + tous les métiers concernés).

Fichier chargé par défaut : `web/data/export.xlsx`.

## Onglet « Référentiel Talent »

Le référentiel de compétences bilingue Talent Brussels. Une Famille (5) regroupe des
Thèmes (40, ex. « Communiquer ») ; chaque Thème se décompose en Compétences granulaires
(109 au total, ex. « Communiquer par écrit ») — c'est cette Compétence qui porte les
niveaux/profils requis. Deux points d'entrée :

- **Par compétence** : description, thème parent (cliquable), profils &amp; niveaux
  requis (cliquables), détail des niveaux du référentiel.
- **Par niveau** : un niveau est un couple **profil + palier** (ex. « Manager – A2 »,
  « Collaborateur·rice – D ») — cliquer dessus liste toutes les compétences requises à
  ce niveau. Un même palier (« A ») n'a pas le même sens d'un profil à l'autre (le grade
  A du profil Manager est lui-même subdivisé en A1/A2/A3/A3+), le niveau est donc défini
  par ce couple, pas par la seule lettre. Ce lien niveau ↔ compétence vient directement
  de l'onglet source `Profils-niveaux-compétences` (joint sur l'ID compétence) — il
  n'est plus déduit des colonnes `Niveau`/`Ordre` des onglets de liens (gardées
  uniquement comme détail informatif sur les pages Thème/Compétence).

Secondaires, cliquables :
- **Thème** : description, compétences numériques (DigComp) rattachées, liste des
  Compétences qui le composent.
- **Famille** : liste des Thèmes.
- **Profil** : liste des niveaux du profil et, pour chacun, les compétences requises.

Fichier chargé par défaut : `web/data/talent.xlsx`.

## Correspondance Competent ↔ Talent

Une table de correspondance (`web/data/matching.csv`) relie des compétences de
l'onglet « Métiers & compétences » (skills essentiels/optionnels, soft skills ou
digital skills — tout ce qui apparaît sous « Par compétence » dans cet onglet) à des
compétences de l'onglet « Référentiel Talent », avec un degré de proximité (exact /
proche / associé). Chaque compétence Competent concernée affiche un bloc « Référentiel
Talent — compétences liées » vers les compétences Talent correspondantes, et
réciproquement chaque compétence Talent concernée affiche un bloc « Métiers &
compétences — compétences liées » — cliquer sur un lien bascule automatiquement sur
l'autre onglet, à la bonne page. C'est le seul pont entre les deux référentiels ; tout
le reste de chaque onglet reste indépendant.

Ce fichier est chargé une fois au démarrage, en arrière-plan (comme les deux exports
par défaut), indépendamment de l'onglet affiché. Pour le mettre à jour, remplacez
`web/data/matching.csv` (colonnes `competent;talent;relation`, une ligne par
correspondance).

## Fonctionnement commun aux deux onglets

Chaque onglet lit et interprète son fichier `.xlsx` **dans le navigateur** ; aucune
donnée n'est envoyée où que ce soit. Le fichier par défaut de l'onglet actif se charge
automatiquement à l'arrivée sur cet onglet. Pour explorer un autre fichier, cliquez sur
l'icône rafraîchir (↻) en haut de la page et choisissez un `.xlsx` — le remplacement ne
vaut que pour la session en cours (et uniquement pour l'onglet actif) et ne modifie pas
le fichier par défaut. Pour changer un fichier par défaut lui-même, remplacez
`web/data/export.xlsx` ou `web/data/talent.xlsx`.

## Utilisation

- **En local** : ouvrez `web/index.html` dans un navigateur (double-clic suffit). Le
  chargement automatique du fichier par défaut nécessite d'être servi en http (voir
  ci-dessous) — en `file://`, l'écran de dépôt de fichier s'affiche directement.
- **Servi (recommandé)** : `npm start` (voir `server.js`) lance un petit serveur Node
  qui sert `web/` sur `http://localhost:3000` (port configurable via `PORT`).

Le fichier « Métiers & compétences » attendu est l'export standard Competent, avec les
onglets `Occupational Profiles`, `Occ.Prof - Alt.Names`, `Occ.Prof - ProofsOfLearning`,
`Occ.Prof - Codes`, `Occ.Prof - Econ.Sectors`, `Occ.Prof - Soft Skills`, `Occ.Prof -
Digital Skills`, `Occ.Prof - Essential Competence`, `Occ.Prof - Optional Competences`,
`Occ.Prof - Areas of Interest`, `Occ.Prof - Competentiesets` (les numéros de version
dans les noms d'onglets, ex. `3.25`, peuvent varier d'un export à l'autre : la lecture
se fait par préfixe de nom). Le fichier « Référentiel Talent » attendu contient les
onglets `Thèmes`, `Compétences`, `Compétences numériques`, `Liens thèmes-niveaux`,
`Compétences par niveau` et `Profils-niveaux-compétences` (ce dernier optionnel : sans
lui, le point d'entrée « Par niveau » et les pages Profil restent simplement vides
plutôt que de faire échouer le chargement).

## Structure

- `web/data/export.xlsx`, `web/data/talent.xlsx` — fichiers chargés par défaut.
- `web/data/matching.csv` — correspondance Competent ↔ Talent (voir plus haut).
- `web/index.html`, `web/style.css` — page et mise en forme partagées par les deux onglets.
- `web/app-shell.js` — bascule d'onglet, icône rafraîchir, sélecteur FR/NL, et
  chargement en arrière-plan des deux jeux de données + de la correspondance.
- `web/parser.js`, `web/app.js` — onglet « Métiers & compétences » (`CompetentApp`) :
  transforme le classeur en modèle de données, puis recherche/navigation/rendu.
- `web/talent-parser.js`, `web/app-talent.js` — onglet « Référentiel Talent »
  (`TalentApp`), en tous points indépendant du premier (mêmes principes, données
  distinctes).
- `web/matching.js` — charge et interroge `matching.csv` ; utilisé par les deux modules
  ci-dessus pour afficher leurs liens croisés.
- `web/vendor/xlsx.full.min.js` — [SheetJS](https://sheetjs.com/) (licence Apache 2.0,
  voir `web/vendor/LICENSE.xlsx.txt`), utilisé pour lire les fichiers Excel côté client.
- `server.js`, `package.json` — serveur statique Node minimal (pour l'hébergement, ex.
  Railway/Railpack).

## Notes

- La langue d'affichage (FR/NL) est commune aux deux onglets ; les champs manquants
  dans la langue choisie retombent automatiquement sur l'autre langue disponible.
- Recharger la page revient aux fichiers par défaut (rien n'est persisté côté
  navigateur) ; un fichier chargé via l'icône rafraîchir ne vaut que pour la session en
  cours.
