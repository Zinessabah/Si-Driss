# 🔍 Si Driss — Rapport d'Audit Complet (2026-10-31)

> **✅ SPRINT 1 LIVRÉ** (commit `c6b44f3`) : C1, C2, C3, H1, H2, H3, H4, H6, H7, M1, M2, M3, M4, M5, M8 corrigés et vérifiés par tests d'attaque en direct (SSRF bloqué, 429 au 11ᵉ appel, gate admin prod 401/401/200). Voir le commit pour le détail.
>
> **✅ SPRINTS 2, 3, 4 + ARCHITECTURE LIVRÉS** : H5, M6, M15 · H8, H9, H10, M12, M16 · M11, M9, M10, M13, M14, dette · découpage de `server.ts` en modules + parser SSE partagé. Détail, mesures et points restants dans le **Journal de livraison** en fin de rapport.

**Périmètre :** backend `server.ts` (1434 lignes), frontend `src/` (28 composants), infra (Docker, Vite, PWA, dépendances).
**Vérifié par exécution :** `tsc --noEmit` ✓ propre, `npm run build` ✓ ~15 s, `npm audit` : 10 vulns (8 modérées, 2 basses — toutes build-time via vite-plugin-pwa/workbox), grep de secrets ✓ aucune vraie clé dans le dépôt.
**Bugs déjà corrigés :** conflit esbuild `^0.25.0` vs Vite 8 → bump `^0.28.0` (npm install cassait à froid).

---

## 🔴 CRITIQUE — à corriger avant tout déploiement public

| # | Fichier:Ligne | Problème | Correctif |
|---|---|---|---|
| C1 | `server.ts:160-162` + `116-149` + `491-509` | **SSRF + exfiltration des clés serveur.** Un client anonyme envoie `x-ai-base-url: https://attaquant.tld/v1` + `provider: openai` sans clé → le serveur injecte sa clé env (fallback) et POST `Authorization: Bearer <clé>` vers l'URL de l'attaquant. Permet aussi de sonder le réseau interne (169.254.169.254…). Présent aussi dans `/api/validate-key` (L930). | N'honorer `baseUrl` que si le client fournit sa propre clé ; jamais de clé env-fallback vers une URL client ; pour `custom`/Ollama, allowlist localhost/RFC1918. |
| C2 | `MathView.tsx:118,133,149` | **XSS via KaTeX `trust: true` + `dangerouslySetInnerHTML`** sur contenu IA non fiable (chat streamé, audits, exercices générés, backups JSON importés). Active `\htmlStyle`, `\htmlClass`, `\includegraphics` → overlay CSS de phishing ("re-saisis ta clé API") ou exfiltration d'URL. Combiné avec la clé en localStorage = vol de clé. | `trust: false` + DOMPurify sur `initialHtml` (déjà dans l'arbre de deps via jspdf). |
| C3 | Toutes les routes | **Aucune authentification.** `/api/chat*`, `/api/evaluate`, `/api/generate-exercise`, documents list/read/upload/delete sont anonymes. Avec le fallback clés env, n'importe qui brûle le quota IA payant du serveur et peut supprimer/remplacer les PDFs officiels. | Middleware d'auth (secret partagé/JWT) + rôle admin pour upload/delete. |

## 🟠 ÉLEVÉ

| # | Fichier:Ligne | Problème | Correctif |
|---|---|---|---|
| H1 | `server.ts` global | **Aucun rate limiting.** `/api/validate-key` (L916) est un oracle de validation de clé non authentifié ; chaque appel = vrai appel API payant. | `express-rate-limit` par IP sur tous les `/api/*`, plus strict sur validate-key/upload. |
| H2 | `server.ts:1339-1378, 868-870` | **Empoisonnement du RAG par injection de prompt stockée.** Upload anonyme dans `docs/programme` → contenu injecté tel quel dans le system prompt de tous les élèves. Le sanitizer de nom accepte les points → on peut écrire directement `foo.pdf.extracted.txt` et court-circuiter le parsing PDF. | Auth admin + rejet des noms `*.extracted.txt` + texte RAG délimité comme données non fiables. |
| H3 | `server.ts:425-552, 990-1047` | **Streaming sans gestion de déconnexion ni timeout.** Aucun `req.on('close')`, aucun AbortController, `res.write` non gardé → tokens brûlés après départ du client, crash possible (`ERR_STREAM_WRITE_AFTER_END`), provider qui pend = socket épinglé à jamais. | AbortController câblé à `res.on('close')`, garder les writes (`res.writableEnded`), `AbortSignal.timeout` par requête. |
| H4 | `AuditWorkspace.tsx:87-101` | **Note fabriquée 14/20 sur toute erreur.** Le `catch` affiche "Bien, 14/20" + le corrigé officiel comme "rédaction corrigée", étiqueté "Note estimée au barème du National" — même sur un 401. Un élève voit une note inventée. | Vrai état d'erreur ; jamais de note inventée ; return anticipé sur 401. |
| H5 | `server.ts:736-739, 1320-1322` | **Texte extrait périmé servi indéfiniment.** Seule l'existence de `foo.pdf.extracted.txt` est testée, jamais les mtimes — remplacer un PDF hors-upload sert l'ancien texte pour toujours. | Comparer `mtime(txt) >= mtime(pdf)`, sinon ré-extraire. |
| H6 | `Dockerfile:14` + absence de `.dockerignore` | `COPY . .` copie `node_modules/`, `.git/` et **`.env`** dans l'image → fuite de clés persistante dans les layers + cache busté. | Ajouter `.dockerignore` : `node_modules .git dist .env*`. |
| H7 | `Dockerfile` | **Conteneur en root** (pas de `USER`). | `USER node` après chown de `/app` et du volume `docs/programme`. |
| H8 | `SocraticChat.tsx:533-535, 212-229` + `MathView.tsx` | **Tempête de re-rendus en streaming :** chaque chunk SSE re-map tout le tableau de messages → re-render de chaque MathView (non mémoïsé, `katex.renderToString` synchrone) + réécriture complète de la session (avec images base64) dans localStorage **par chunk**. | `React.memo(MathView)`, flush throttlé (rAF/50 ms), autosave debouncée ~1 s. |
| H9 | `SocraticChat.tsx:310-377, 471-475` | **Pièces jointes sans limite + historique complet renvoyé à chaque requête** (toutes les images base64 de toute la session à chaque message) → quotas mémoire localStorage dépassés en silence, payloads énormes. | Cap ~5 Mo / 3 fichiers ; n'envoyer les PJ que du dernier message. |
| H10 | Bundle 2,0 Mo (565 ko gz) | **Aucun code-splitting** : jspdf + html2canvas + docx + KaTeX + 5 simulateurs + 117 ko de `data/*` dans le chunk d'entrée. | `import()` dynamique de l'exporteur au clic, `React.lazy` simulateurs, `manualChunks`. |

## 🟡 MOYEN

| # | Fichier:Ligne | Problème | Correctif |
|---|---|---|---|
| M1 | `server.ts:457,522,683,976,1044,1086` | Corps d'erreur des providers renvoyés verbatim aux clients (internals, URLs, parfois écho de requête). | Message générique + log serveur. |
| M2 | `server.ts:954,966,977` | `/api/validate-key` renvoie `sanitizedKey` (écho de la clé). | Ne renvoyer que boolean + modèle. |
| M3 | `server.ts:1296` + `882-913` | `absolutePath` du FS exposé ; `/api/ai-status` énumère les providers configurés. | Retirer le champ ; restreindre ai-status. |
| M4 | `server.ts:146-149` | Si un élève choisit Groq sans clé et que `GEMINI_API_KEY` existe, le provider est **silencieusement** rebasculé vers Gemini (conversation envoyée à Google alors que l'UI dit Groq). | 401 au lieu de changer de provider. |
| M5 | `index.html:77` + `vite.config.ts` | KaTeX CSS chargée depuis jsdelivr **v0.16.21 sans SRI** alors que l'app bundle **katex@0.19.1** (mismatch glyphes + supply-chain) ; pas de `runtimeCaching` → fonts/KaTeX cassés hors-ligne malgré la PWA. | `import 'katex/dist/katex.min.css'` dans l'app, supprimer le lien CDN. |
| M6 | `server.ts:47,68-72,53` + `.env.example:16` | IDs de modèles Gemini suspects (`gemini-3.5-flash-lite`, `gemini-3-flash-preview`…) ; `.env.example` met `AI_MODEL=gemini-3.8-flash` que L80 blackliste ensuite → install fraîche = rewrite silencieux. | Épingler des IDs publics vérifiés ; réconcilier l'exemple et la blocklist. |
| M7 | `server.ts:713-757, 1247, 1305` | I/O sync bloquantes dans le chemin chaud (`readdirSync/statSync/readFileSync` à chaque chat) ; GET avec effets de bord (pdf-parse + writeFileSync, race entre requêtes concurrentes). | Rafraîchir le cache sur upload/delete + watcher ; GETs en lecture seule. |
| M8 | `server.ts:670` | Retry JSON-mode : `messages[0].content += ...` corrompt un contenu multimodal (array → "[object Object]"). | Ajouter un message user séparé. |
| M9 | `tsconfig.json` | Pas de `"strict": true`. | Activer `strict`. |
| M10 | `package.json:44,37,2` | `typescript: ^7.0.2` (preview native) comme seul compilateur ; `@types/pdf-parse@^1.1.5` obsolète (v2 embarque ses types) ; `name: "react-example"` ; double lockfile npm+bun. | TS 5.9 stable ; retirer @types/pdf-parse ; renommer ; un seul lockfile. |
| M11 | `SocraticChat.tsx:449` / `App.tsx:220-227` | Stream + TTS non annulés au démontage (changement d'onglet démonte SocraticChat → tokens brûlés en silence, speechSynthesis continue). | Garder monté (CSS-hidden) ou AbortController en cleanup. |
| M12 | `MathView.tsx:111-139` | Double rendu KaTeX par formule (`renderToString` + `katex.render` en effet) ; macros spread par render ; clés indexées qui bougent pendant le stream. | Un seul chemin de rendu ; macros hoistées ; clés par hash de contenu. |
| M13 | `useApiKey.ts:126-133` | Clé en double écriture (nouvelle + legacy `sidriss_student_gemini_api_key_v1`) ; `getInitialConfig` écrit dans localStorage dans un initializer (impur, double sous StrictMode). | Supprimer la double écriture ; migration au niveau module ou effet. |
| M14 | Accessibilité | Aucun `role="dialog"`/`aria-modal`, pas d'Escape ni focus trap (8 modales + lightbox) ; divs cliquables au lieu de boutons ; bouton supprimer invisible hors hover (`GeminiSidebar.tsx:181`) ; `user-scalable=no` (`index.html:5`, violation WCAG 1.4.4). | Sémantique dialog, Escape, focus trap, `<button>`, réactiver le zoom. |
| M15 | `documentVault.ts:63-65` + `SocraticChat.tsx:287` | Échecs de persistance silencieux alors que l'UI affirme "sauvegardé en permanence !". | Propager + toast d'erreur. |
| M16 | `documentExporter.ts:1463-1520` | html2canvas `scale: 2` PNG pleine page par page A4 sur le main thread → gel de l'UI. | JPEG ~0.92, yield entre pages, indicateur de progression. |

## 🔵 FAIBLE (échantillon)

- `server.ts:477,542` : `break` sur `[DONE]` ne sort que de la boucle interne ; `catch {}` vides avalent les erreurs SSE/fs.
- `server.ts:447,615` : `max_tokens: 4096` hardcodé tronque les corrections longues Anthropic ; `generate-exercise` `JSON.parse` (L1225) sans fallback → 500 opaque.
- `package.json:8` : `npm start` = `node server.ts` ne marche que sur Node ≥ 22.18.
- `server.ts:392,574` : `User-Agent: 'aistudio-build'` (spoof AI Studio, ToS-questionable).
- `.env.example:7,46` : `NODE_ENV=development` par défaut ; `OLLAMA_BASE_URL` actif → `/api/ai-status` déclare `serverConfigured: true` à tort.
- `Dockerfile:28` : `npm install -g tsx` non épinglé ; prod exécute du TS source plutôt que du JS compilé.
- `public/favicon.ico` est un PNG renommé ; `vite.config.ts:65` `hmr:false` global ; manifest dit "Application Android" ; script de suppression d'erreurs `index.html:20-75` masque de vraies erreurs en prod.
- Frontend : `SessionManagerModal.tsx` (604 lignes) jamais rendu + `AndroidBottomNav.tsx` mort ; `initialPrompt` stale (`App.tsx:44`) ; `useApiKey()` sondé 5× au démarrage ; scroll forcé pendant le stream ; `confirm()/alert()` natifs partout.
- Vulns npm : 10 (toutes build-time, chaîne workbox) — surveiller, ne **pas** lancer `npm audit fix --force` (casse vite-plugin-pwa).

---

## 🗺️ Feuille de route proposée

**Sprint 1 — Sécurité (bloquant pour mise en ligne)**
C1 SSRF/clés · C3 auth API + admin docs · H1 rate limiting · C2 KaTeX trust+DOMPurify · H2 uploads `.extracted.txt` · H6 `.dockerignore` · H7 USER node · M1-M4 fuites d'erreurs & chemins · M5 KaTeX bundlé

**Sprint 2 — Fiabilité pédagogique**
H4 note fabriquée · H5 mtimes extracted.txt · M6 IDs modèles réels · M8 retry JSON · M15 erreurs de persistance visibles

**Sprint 3 — Performance**
H8 stream throttlé + memo MathView · H9 limites PJ · H10 code-splitting · M12 rendu KaTeX unique · M16 export PDF

**Sprint 4 — Robustesse & qualité**
H3 abort/timeout streaming · M11 unmount cleanup · M9 strict TS · M10 toolchain · M14 a11y · dette (dead code, lockfile unique, favicon)

**Architecture (transverse) :** sortir `providers/` (stratégie par provider), `rag/`, `prompts/`, `routes/` du monolithe ; parser SSE partagé (le bloc OpenAI-compatible est copié-collé 4×) ; pipeline middleware centralisé.

## ✅ Points positifs à conserver

- Sanitisation des clés robuste (`sanitizeApiKey` côté serveur + client), migration legacy propre
- `path.basename` partout sur les fichiers (pas de path traversal)
- Aucune vraie clé dans le dépôt ; `.gitignore` couvre `.env*`
- PWA complète et correcte (icônes vérifiées, denylist `/api/*` OK)
- Boucles rAF des simulateurs avec cleanup propre ; effets React majoritairement bien nettoyés
- `noopener noreferrer` sur les liens externes ; tsc propre ; build reproductible

---

## 📦 Journal de livraison — Sprints 2, 3, 4 & architecture (2026-10-31)

### Sprint 2 — Fiabilité pédagogique

- **H5 — texte extrait périmé** : ajout de `isExtractedTextFresh()` + `getFreshExtractedPdfText()`. Les 3 chemins (cache RAG, `GET /api/documents`, `GET /api/documents/file`) ré-extraient désormais dès que `mtime(.extracted.txt) < mtime(.pdf)`. `refreshDocumentsCache()` / `searchLocalDocuments()` passés en async (les deux routes de chat les attendent).
- **M6 — IDs de modèles** : vérification contre la documentation officielle `ai.google.dev/gemini-api/docs/models` (maj 2026-10-28) → `gemini-3.8-flash` est **stable et actuel** et `gemini-flash-latest` un alias valide : tous deux **retirés** des blocklists (serveur + client `useApiKey`). `gemini-3.6-flash` (stable) remplace `gemini-3-flash-preview` (preview) dans les fallbacks. `AI_MODEL=gemini-3.8-flash` de `.env.example` n'est plus réécrit silencieusement (`serverModel` confirmé au smoke test).
- **M15 — échecs de persistance silencieux** : `saveDocumentToVault()` / `removeDocumentFromVault()` propagent leurs erreurs ; DocumentManager distingue l'indexation serveur de la copie locale permanente et alerte en cas d'échec ; SocraticChat affiche un toast `role="status"` quand l'autosave localStorage échoue (quota).
- **Bonus zéro-invention (esprit H4)** : `/api/evaluate` ne fabrique plus un « 15/20 Bien » quand le JSON du fournisseur est illisible → 502 honnête, l'UI affiche sa bannière d'erreur ; `/api/generate-exercise` renvoie un 502 explicite au lieu d'un 500 opaque.
- **H4 / M8** : vérifiés déjà livrés au Sprint 1 (bannière d'erreur honnête dans AuditWorkspace ; retry JSON par message séparé).

### Sprint 3 — Performance

- **H8** : flush SSE throttlé par `requestAnimationFrame` (1 re-render du message en cours par frame, au lieu d'un `setState` par chunk) ; `MathView` et `KatexContainer` mémoïsés ; autosave localStorage debouncée à 1 s.
- **H9** : 3 pièces jointes max par message, 5 Mo max par fichier, avec message explicite ; **seul le dernier message utilisateur** transporte ses PJ vers l'API (payload divisé, quotas mémoire préservés).
- **H10** : `React.lazy` sur les 4 onglets secondaires, les 5 simulateurs et le générateur d'exercices ; `import()` dynamique de l'exporteur (jspdf + html2canvas + docx) au clic ; `manualChunks` vendor-react / vendor-katex.
  **Mesuré : bundle initial 2,0 Mo (565 ko gz) → ~1,05 Mo (~309 ko gz) ; exporteur 848 ko chargé à la demande ; 23 chunks.**
- **M12** : un seul rendu KaTeX par formule (`useMemo`, suppression du double rendu « initial + effet »), clés React stables par hash de contenu pendant le streaming, macros non ré-étalées à chaque rendu parent.
- **M16** : export PDF en **JPEG 0,92** (au lieu de PNG), `setTimeout(0)` entre les pages pour rendre la main au thread principal, progression `PDF 2/5` sur le bouton via `onProgress`.

### Sprint 4 — Robustesse & qualité

- **M11** : SocraticChat **reste monté** (masqué en CSS) → changer d'onglet n'interrompt plus le stream ; à la destruction réelle, `AbortController` et `speechSynthesis.cancel()`.
- **M9** : `"strict": true` activé — **0 erreur** (seul conflit corrigé : `onClose` optionnel du sélecteur de filière).
- **M10** : paquet renommé `si-driss` ; `start` = `tsx server.ts` avec `tsx` en dépendance de production ; `@types/pdf-parse` retiré (pdf-parse v2 embarque ses types) ; `bun.lock` supprimé (lockfile unique npm) ; `package-lock.json` resynchronisé.
  **Constat : `typescript@7.0.2` est le tag `latest` sur npm (pas une preview comme supposé) — version conservée.**
- **M14** : hook `useModalA11y` (role dialog, aria-modal, Échap, piège de focus, restitution du focus) appliqué aux 7 modales + modale de création de document + visionneuse d'image ; `user-scalable=no` retiré (WCAG 1.4.4) ; bouton « supprimer » de la sidebar visible hors hover + `aria-label`.
- **M13** : migration de l'ancienne clé Gemini exécutée **une fois au chargement du module** (plus d'écriture impure dans un initializer, plus de double écriture legacy) ; sonde `/api/ai-status` mutualisée (1 appel réseau au démarrage au lieu de 5).
- **Dette** : `SessionManagerModal` (604 l.), `AndroidBottomNav`, `BranchBadge` supprimés (types déplacés dans `src/types/chat.ts`) ; faux `favicon.ico` (PNG renommé) supprimé et manifest PWA corrigé (plus « Application Android », mention PC & SM) ; script inline d'`index.html` qui masquait de vraies erreurs supprimé ; `initialPrompt` rendu non-stale par nonce ; `serverConfigured` ne ment plus quand seul `OLLAMA_BASE_URL` est défini ; toute route `/api/*` inconnue répond **404 JSON** (plus la SPA en 200).

### Architecture (transverse)

- `server.ts` : **1 768 → 66 lignes**, simple point d'entrée.
- Nouveaux modules : `server/config.ts` (env, dotenv chargé en premier), `server/security.ts` (limiteurs + gates), `server/ai/providers.ts`, `server/ai/adapters.ts`, `server/ai/sse.ts` (**parser SSE partagé**), `server/ai/completion.ts`, `server/rag.ts`, `server/prompts.ts`, `server/routes/ai.ts`, `server/routes/documents.ts`.
- **Parser SSE unique** : les deux boucles de lecture dupliquées (Anthropic + OpenAI-compatibles) sont remplacées par `pipeSseEvents()` ; au passage `[DONE]` termine réellement la lecture (l'ancien `break` ne sortait que de la boucle interne).
- `Dockerfile` mis à jour : le dossier `server/` est copié dans l'image runtime (sinon le conteneur ne démarre plus).
- **Vérifié par exécution** : `tsc --noEmit` 0 erreur (strict), `npm run build` ✓, smoke test production sur `:3100` (bannière, `/` 200, `/api/ai-status` honnête, `/api/documents` 200 avec previews, `/api/documents/file` contenu, `/api/*` inconnu 404 JSON).

### Reste ouvert (non bloquant)

- **M7** : I/O sync dans le rafraîchissement du cache RAG (`readdirSync/statSync`) — l'extraction PDF est désormais async et déclenchée à la demande.
- **M5 résiduel** : l'iframe d'export PDF référence encore KaTeX 0.16.21 via CDN pour ses polices (export 100 % hors-ligne à durcir).
- **M3 partiel** : `/api/ai-status` expose toujours le nom du provider par défaut et le modèle (aucune clé) — utile au diagnostic.
- `confirm()` natif restant dans la sidebar (suppression de discussion) — migration vers une modale maison à faire.
- `documentExporter` reste un chunk de 848 ko : lazy, mais scindable en jspdf / docx.
