# Dossier des Documents du Programme (2ème Bac PC BIOF)

Ce répertoire est l'emplacement officiel où tu peux déposer tes documents de cours, résumés, séries d'exercices et annales d'examen pour que Si Mohamed y accède instantanément.

## 📂 Chemin absolu du répertoire :
`/docs/programme/`

## 📄 Formats recommandés :
- `.md` (Markdown - idéal pour les résumés et formules)
- `.txt` (Fichiers texte brut)
- `.json` (Données structurées d'exercices ou questions)
- `.csv` (Tableaux de données ou constantes)

## ⚡ Comment ça fonctionne pour accélérer les réponses ?
1. **Indexation locale ultra-rapide** : Dès qu'un fichier est placé dans `/docs/programme/` ou téléversé via l'onglet **"Base Documentaire"** dans l'application, Si Mohamed indexe son contenu en mémoire.
2. **Recherche contextuelle ciblée** : Quand tu poses une question, Si Mohamed extrait immédiatement le paragraphe exact de tes documents pour répondre sans délai.
3. **Streaming temps réel** : Les réponses s'affichent mot par mot instantanément sans temps d'attente.

## Annales du baccalauréat PC

Le script autonome `scripts/scrape-bac-physics-exams.js` collecte les sujets PDF de physique-chimie, sessions normale et rattrapage, et les enregistre dans `docs/programme/PC/`. Il utilise uniquement les modules intégrés à Node.js :

```bash
node scripts/scrape-bac-physics-exams.js
```

La plage par défaut va de 2008 à 2025. Elle peut être ajustée avec `--start-year` et `--end-year`. Le workflow indépendant `.github/workflows/scrape-bac-examens.yml` s'exécute chaque lundi ou manuellement et pousse les nouveaux PDF dans le dépôt. Les documents déjà présents sont conservés. Une année/session introuvable ou un refus du site fait échouer le script, sans contourner les protections d'accès.
