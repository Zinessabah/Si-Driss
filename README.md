# 🎓 Si Driss - Plateforme Universelle 2ème Bac BIOF (PC & SM)

> **Plateforme universelle d'entraînement intensif, de coaching socratique et d'audit d'examen en Physique-Chimie (2ème Bac Maroc BIOF).**  
> Conçue pour fonctionner **partout** : en local sur votre ordinateur, sur un serveur privé (VPS), avec Docker, ou dans le Cloud (Google Cloud Run, Render, Railway, Vercel), avec **n'importe quel fournisseur d'IA** au choix.

---

## 🌟 Fournisseurs IA Supportés (Universel)

L'application intègre un **moteur universel multi-fournisseurs** compatible avec :

| Fournisseur | Modèles recommandés | Type de clé | Vitesse / Caractéristiques |
| :--- | :--- | :--- | :--- |
| **Google Gemini** | `gemini-3.8-flash`, `gemini-flash-latest` | Gratuite ([Google AI Studio](https://aistudio.google.com/app/apikey)) | Vision, calculs détaillés & gratuit |
| **Groq Cloud** | `llama-3.3-70b-versatile`, `deepseek-r1-distill-llama-70b` | Gratuite ([console.groq.com](https://console.groq.com/keys)) | **Ultra-rapide (~300 tokens/sec)** |
| **OpenAI** | `gpt-4o-mini`, `gpt-4o`, `o3-mini` | API Key ([platform.openai.com](https://platform.openai.com/api-keys)) | Précision STEM de haut niveau |
| **Anthropic Claude** | `claude-3-5-sonnet`, `claude-3-5-haiku` | API Key ([console.anthropic.com](https://console.anthropic.com/settings/keys)) | Élite rédactionnelle & rigueur |
| **DeepSeek** | `deepseek-flash` (V4.1), `deepseek-v4-pro` | API Key ([platform.deepseek.com](https://platform.deepseek.com/api_keys)) | Rapport qualité/prix imbattable, mode Thinking par défaut |
| **Mistral AI** | `mistral-small-latest`, `mistral-large-latest` | API Key ([console.mistral.ai](https://console.mistral.ai/api-keys/)) | Modèles européens, excellence en français |
| **OpenRouter** | Tous modèles (+100) avec 1 seule clé | API Key ([openrouter.ai](https://openrouter.ai/keys)) | Agrégateur universel |
| **Ollama / Local** | `llama3.3`, `qwen2.5:14b`, `deepseek-r1:14b` | **Sans clé (100% gratuit & hors-ligne)** | Confidentialité totale sur PC personnel |

---

## 🚀 1. Lancement Rapide en Local (Node.js)

### Prérequis
- [Node.js](https://nodejs.org/) v18 ou version supérieure
- npm (fourni avec Node.js)

### Étapes d'installation :
```bash
# 1. Cloner ou télécharger le projet
git clone https://github.com/votre-depot/si-driss-universal.git
cd si-driss-universal

# 2. Installer les dépendances
npm install

# 3. (Optionnel) Créer le fichier .env
cp .env.example .env

# 4. Lancer le serveur en mode développement
npm run dev
```

L'application s'ouvre directement sur **`http://localhost:3000`** !

---

## 🐳 2. Lancement avec Docker & Docker Compose

Vous pouvez lancer l'application d'une seule commande sans installer Node.js :

```bash
# Lancement instantané
docker compose up -d
```

L'application sera accessible sur **`http://localhost:3000`**.

### Pour stopper l'application :
```bash
docker compose down
```

---

## 💻 3. Mode 100% Local & Hors-ligne avec Ollama (Sans Clé API)

Pour utiliser Si Driss sans connexion Internet et sans payer de clé API :

1. Installez [Ollama](https://ollama.ai) sur votre machine (Windows, Mac ou Linux).
2. Téléchargez un modèle scientifique performant :
   ```bash
   ollama run llama3.3
   # ou pour les calculs formels :
   ollama run qwen2.5:14b
   ```
3. Dans l'application Si Driss :
   - Cliquez sur le badge en haut à droite **« Choisir Moteur IA »**.
   - Sélectionnez la carte **« Ollama / Modèle Local »**.
   - Vérifiez l'URL (par défaut : `http://localhost:11434/v1`).
   - Cliquez sur **« Tester & Activer »** ou **« Enregistrer »**.

---

## ☁️ 4. Déploiement en Cloud

### A. Déploiement sur un Serveur VPS (Ubuntu / Debian / Docker)
Sur votre serveur distant :
```bash
git clone <url-du-depot>
cd si-driss
npm install
npm run build
npm start
```
Ou avec Docker :
```bash
docker compose up -d --build
```
Configurez Nginx comme reverse-proxy vers le port `3000` avec un certificat SSL Let's Encrypt (`certbot`).

### B. Déploiement sur Render / Railway
1. Liez votre dépôt GitHub à [Render](https://render.com) ou [Railway](https://railway.app).
2. Choisissez **Web Service**.
3. **Build Command** : `npm install && npm run build`
4. **Start Command** : `npm start`
5. Ajoutez les variables d'environnement souhaitées dans les paramètres (`AI_PROVIDER`, `GROQ_API_KEY`, `GEMINI_API_KEY`, etc.).

### C. Déploiement sur Google Cloud Run
Construisez et déployez l'image Docker en 1 ligne :
```bash
gcloud run deploy si-driss --source . --port 3000 --allow-unauthenticated
```

---

## 📚 5. Indexation des Documents du Programme Marocain

Vous pouvez déposer n'importe quel document officiel (Cadre de référence, fiches de cours, sujets d'examens nationaux au format PDF ou texte) dans le dossier :
```text
/docs/programme/
```
Le serveur Si Driss indexe automatiquement ces documents en mémoire vive et les utilise instantanément pour vérifier les questions des élèves.

Vous pouvez également téléverser des documents directement depuis l'interface via l'onglet **« Documents du Programme »**.

---

## 🎯 6. Rigueur & Conformité au Baccalauréat Marocain

- **Différenciation PC vs SM** :
  - Filière PC : modulation d'amplitude AM, dipôles RC/RL/RLC, mécanique de translation, cinétique chimique.
  - Filière SM : rotation du solide autour d'un axe fixe (RFD des moments $\sum M_\Delta = J_\Delta \ddot{\theta}$), oscillations mécaniques et électriques forcées (impédance $Z$ et bande passante à -3 dB), équations différentielles analytiques d'ordre 2.
- **Règle absolue Zéro Invention** : Si un énoncé ou une courbe manque d'une donnée numérique, Si Driss le signale immédiatement sans jamais inventer de nombre au hasard.
- **Formules en LaTeX** : Rendu mathématique parfait via KaTeX avec affichage des expressions littérales avant toute application numérique.
