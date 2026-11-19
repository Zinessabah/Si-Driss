# Dossier des Documents du Programme (2ème Bac Marocain - PC & SM BIOF)

Ce répertoire contient les documents officiels du programme ministériel marocain, les cadres de référence officiels, les cours et les annales du Baccalauréat National.

## 📚 Cadres de Référence Officiels (Conformes 100% au Ministère Marocain)

- **Filière PC (Sciences Physiques) :**
  - [Cadre de Référence Chimie 2BAC PC](file:///home/driss/Bureau/Si-Driss/docs/programme/PC/cadre_reference_chimie_2bac_pc.md)
  - [Cadre de Référence Physique 2BAC PC](file:///home/driss/Bureau/Si-Driss/docs/programme/PC/cadre_reference_physique_2bac_pc.md)
- **Filière SM (Sciences Mathématiques A & B) :**
  - [Cadre de Référence Physique & Chimie 2BAC SM](file:///home/driss/Bureau/Si-Driss/docs/programme/SM/cadre_reference_physique_chimie_2bac_sm.md)

> [!IMPORTANT]
> **Règle d'or du programme marocain :**
> - La loi de Beer-Lambert / spectrophotométrie **NE FAIT PAS PARTIE** du programme marocain. Seules 5 méthodes officielles de suivi cinétique sont admises : Pression, Volume de gaz, Conductimétrie, pH-métrie, et Titrage volumétrique avec trempe.
> - La modulation d'amplitude (AM) est exclusive à la filière **PC**.
> - La rotation autour d'un axe fixe, les oscillations électriques et mécaniques forcées avec résonance/impédance, le pendule de torsion et la force magnétique de Lorentz sont exclusifs à la filière **SM**.

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
