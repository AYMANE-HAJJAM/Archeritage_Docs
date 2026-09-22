# Plan d’import documentaire

Inventaire réalisé le 16 septembre 2026 depuis le corpus local `source_import/` (gitignored, never served).

**Status:** historical decision record for the initial Safi import. Runtime does not read `source_import/`. Ops re-import uses `npm run import:documents` when the local corpus is present. Automated tests use `tests/fixtures/` plus optional corpus hash checks.

## Résumé

| Projet | Fichiers source | Copies exactes | Prêts | À confirmer |
| --- | ---: | ---: | ---: | ---: |
| Château de Mer — Safi | 15 | 0 | 14 | 1 |
| Murailles portugaises de Safi | 20 | 3 | 16 | 1 |
| **Total** | **35** | **3** | **30** | **2** |

## Copies exactes détectées par SHA-256

- `Muraille portugaise tranche VI-Objet (1).pdf` est identique à `Muraille portugaise tranche VI-Objet.pdf` (`F6366AD…`).
- La copie de `Muraille portugaise tranche IX-Objet.pdf` dans `muraille de safi Photos 1ere tranche/` est identique à celle de `les plans et photos/` (`AEC0C7A…`).
- La copie de `Plan Bab EL Kasbah-Objet.pdf` dans `muraille de safi Photos 1ere tranche/` est identique à celle de `les plans et photos/` (`C71B1E2…`).

Les deux fichiers `synthese_donnees_plans.docx` ont la même taille mais des SHA-256 différents. Ils sont conservés tous les deux.

## Château de Mer — Safi

### 01 — Consultation

- `Pack_consultation_Chateau_de_Mer_Safi_V2_enrichi.docx` → **Pack de consultation — Château de Mer — Safi.docx**
- `les étapes a prtéparer pour la consultation.docx` → **Étapes de préparation de la consultation.docx**
- `mlettre d'intention equipe.docx` → **Lettre d’intention — Équipe.docx**
- `model CV mission chateau de mer.docx` → **Modèle CV — Mission Château de Mer.docx**
- `Mémoire technique.docx` → **Mémoire technique.docx**

### 02 — Études et expertise

- `rapport provisoire expertise kssar lebhar safi envoyé.pdf` → **Rapport provisoire d’expertise — Ksar El Bahr — Safi.pdf**

### 03 — Documentation et archives

- `article.docx` et `article2.docx` → deux fichiers distincts, affichés comme **Le Château de mer de Safi en péril — Article[ 2].docx**
- `chateau de mer.docx` → **Château de Mer — Documentation historique.docx**
- `portuaire safi.pdf` → **Documentation portuaire — Safi.pdf**
- le dossier juridique, les deux bulletins officiels et le répertoire des dahirs conservent des titres corrigés et explicites.

### À confirmer

- `lecture chateau de mer/lecture 1.docx` : destination documentaire probable, mais son titre utile ne peut pas être établi avec assez de certitude.

## Murailles portugaises de Safi

### 01 — Consultation

- `CPS etude.docx` → **CPS — Étude des murailles portugaises de Safi.docx**
- `les 3 pieces complémentaires.docx` → **Trois pièces complémentaires.docx**
- `RC.docx` → **Règlement de consultation.docx**

### 02 — Plans et relevés

- Tranches III, IV, V, VI et IX : un PDF unique par tranche, sans sous-dossier superflu.
- Bab El Kasbah : **Plan — Bab El Kasbah.pdf**.
- Les trois copies exactes listées plus haut sont ignorées.

### 03 — Diagnostic et analyses

- `Atlas des pathologies.docx`
- `ANALYSE_COMPARATIVE_ET_RECOMMANDATIONS.docx` → **Analyse comparative et recommandations.docx**
- les deux synthèses distinctes → **Synthèse des données des plans.docx** et **… — Variante.docx**

### 04 — Documents de travail

- `CPS 2.docx`, `CPS_4 SAFI_REVISÉ_COMPLET.docx` et `CPS 6 PERP.docx`, avec des noms d’affichage sobres indiquant leur version.

### À confirmer

- `CPS_5 SAFI_FINAL_EXCELLENCE_INEGALEE MANUS.docx` : le nom indique simultanément une version numérotée et « FINAL ». Il faut choisir entre **01 — Consultation** et **04 — Documents de travail**.

## Exécution contrôlée

`npm run import:documents` inspecte, recalcule les SHA-256 et affiche le plan sans rien envoyer. L’import réel utilise `npm run import:documents:execute`, mais il refuse de démarrer tant que les deux éléments ci-dessus restent à confirmer. Il vérifie PostgreSQL, Cloudinary et B2 avant le premier envoi, puis utilise `sourceHash` pour ignorer les fichiers déjà importés lors d’une nouvelle exécution.
