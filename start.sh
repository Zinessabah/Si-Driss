#!/usr/bin/env bash

# ==============================================================================
# Script de démarrage universel - Si Driss (Backend Express + Frontend Vite)
# ==============================================================================

set -e

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# 1. Détection de la racine du projet Si-Driss
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/package.json" ]; then
  PROJECT_DIR="$SCRIPT_DIR"
elif [ -d "$SCRIPT_DIR/Si-Driss" ] && [ -f "$SCRIPT_DIR/Si-Driss/package.json" ]; then
  PROJECT_DIR="$SCRIPT_DIR/Si-Driss"
else
  echo -e "${RED}❌ Erreur : Impossible de localiser le dossier Si-Driss contenant package.json${NC}"
  exit 1
fi

cd "$PROJECT_DIR"

# Bannière d'accueil
echo -e "${CYAN}${BOLD}"
echo "================================================================"
echo "    🎓 SI DRISS - PLATEFORME UNIVERSELLE 2ÈME BAC BIOF          "
echo "================================================================"
echo -e "${NC}"

# 2. Vérification des prérequis (Node.js et npm)
echo -e "${BLUE}🔍 Vérification de l'environnement système...${NC}"

if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}❌ Node.js n'est pas installé. Veuillez installer Node.js (v18+) : https://nodejs.org/${NC}"
  exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js détecté : ${NODE_VERSION}${NC}"

if ! command -v npm >/dev/null 2>&1; then
  echo -e "${RED}❌ npm n'est pas installé.${NC}"
  exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm détecté : v${NPM_VERSION}${NC}"

# 2.5. Contrôle de synchronisation avec le serveur Cloud (si-driss.onrender.com)
echo -e "${BLUE}☁️  Contrôle de synchronisation avec le Cloud (si-driss.onrender.com)...${NC}"
CLOUD_API="https://si-driss.onrender.com/api/version"
LOCAL_COMMIT=""
if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then
  LOCAL_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || true)
fi

CLOUD_INFO=$(curl -s --connect-timeout 2 -m 4 "$CLOUD_API" 2>/dev/null || true)
if [ -n "$CLOUD_INFO" ] && echo "$CLOUD_INFO" | grep -q '"commit"'; then
  CLOUD_COMMIT=$(echo "$CLOUD_INFO" | grep -o '"commit":"[^"]*"' | cut -d'"' -f4 | cut -c1-7)
  CLOUD_DATE=$(echo "$CLOUD_INFO" | grep -o '"commitDate":"[^"]*"' | cut -d'"' -f4)
  
  if [ -n "$LOCAL_COMMIT" ] && [ -n "$CLOUD_COMMIT" ]; then
    if [ "$CLOUD_COMMIT" = "latest" ] || [ "$LOCAL_COMMIT" = "$CLOUD_COMMIT" ] || git merge-base --is-ancestor "$CLOUD_COMMIT" HEAD 2>/dev/null; then
      echo -e "${GREEN}✓ Code local à jour et synchronisé avec le Cloud (commit ${LOCAL_COMMIT}).${NC}"
    else
      echo -e "${YELLOW}⚡ Une mise à jour est disponible sur le serveur Cloud !${NC}"
      echo -e "   • Local : ${BOLD}${LOCAL_COMMIT}${NC}"
      echo -e "   • Cloud : ${BOLD}${CLOUD_COMMIT}${NC} (${CLOUD_DATE})"
      printf "👉 Voulez-vous synchroniser votre code local maintenant (git pull) ? (O/n) : "
      read -t 10 -r do_update || do_update="O"
      echo ""
      if [[ "$do_update" =~ ^[OoYy]$ ]] || [ -z "$do_update" ]; then
        echo -e "${BLUE}📥 Téléchargement de la dernière version...${NC}"
        git pull origin main || echo -e "${YELLOW}⚠️ Impossible d'exécuter git pull automatiquement.${NC}"
        npm install --prefer-offline --no-audit || true
        echo -e "${GREEN}✓ Synchronisation terminée.${NC}"
      else
        echo -e "${YELLOW}Poursuite du démarrage avec la version locale actuelle.${NC}"
      fi
    fi
  fi
else
  echo -e "${CYAN}ℹ️  Serveur cloud en attente ou hors-ligne (démarrage en mode autonome).${NC}"
fi

# 3. Vérification du fichier de configuration .env
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    echo -e "${YELLOW}⚠️  Fichier .env absent. Création automatique à partir de .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ Fichier .env initialisé avec succès.${NC}"
  else
    echo -e "${YELLOW}⚠️  Aucun fichier .env ou .env.example trouvé.${NC}"
  fi
fi

# 4. Vérification et installation des dépendances si nécessaire
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 node_modules manquant. Installation des dépendances (npm install)...${NC}"
  npm install
  echo -e "${GREEN}✓ Dépendances installées avec succès.${NC}"
fi

# 5. Détection du PORT
PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d '=' -f2 | tr -d ' "' || true)
if [ -z "$PORT" ]; then
  PORT=3000
fi

# 6. Vérification si le port est déjà occupé
PORT_PID=$(lsof -ti :$PORT 2>/dev/null || true)
if [ -n "$PORT_PID" ]; then
  echo -e "${YELLOW}⚠️  Le port ${PORT} est déjà utilisé (Processus PID: ${PORT_PID}).${NC}"
  printf "Voulez-vous libérer le port ${PORT} en tuant ce processus ? (o/N) : "
  read -r answer
  if [[ "$answer" =~ ^[OoYy]$ ]]; then
    kill -9 $PORT_PID 2>/dev/null || true
    echo -e "${GREEN}✓ Port ${PORT} libéré.${NC}"
  else
    echo -e "${RED}❌ Port ${PORT} occupé. Arrêt du démarrage.${NC}"
    exit 1
  fi
fi

# 7. Analyse des arguments de commande
MODE="dev"
OPEN_BROWSER=true

for arg in "$@"; do
  case "$arg" in
    prod|production)
      MODE="prod"
      ;;
    docker)
      MODE="docker"
      ;;
    dev)
      MODE="dev"
      ;;
    --no-open)
      OPEN_BROWSER=false
      ;;
  esac
done

echo ""
echo -e "${BOLD}🚀 Lancement de l'application (Backend Express + Frontend Vite)...${NC}"
echo -e "${CYAN}📍 Accessible à l'adresse : ${BOLD}http://localhost:${PORT}${NC}"
echo -e "${YELLOW}💡 Pour arrêter l'application, appuyez sur Ctrl+C${NC}"
echo "----------------------------------------------------------------"

# Fonction d'ouverture du navigateur
open_browser() {
  if [ "$OPEN_BROWSER" = true ]; then
    sleep 2
    if [[ "$OSTYPE" == "darwin"* ]]; then
      open "http://localhost:${PORT}" 2>/dev/null || true
    elif command -v xdg-open >/dev/null 2>&1; then
      xdg-open "http://localhost:${PORT}" 2>/dev/null || true
    fi
  fi
}

# 8. Exécution selon le mode choisi
case "$MODE" in
  prod)
    echo -e "${BLUE}Mode Production : compilation de l'interface Vite...${NC}"
    npm run build
    open_browser &
    NODE_ENV=production npm start
    ;;
  docker)
    echo -e "${BLUE}Mode Docker : démarrage des conteneurs via Docker Compose...${NC}"
    open_browser &
    docker compose up
    ;;
  dev)
    echo -e "${BLUE}Mode Développement : démarrage avec rechargement à chaud (Hot Reload)...${NC}"
    open_browser &
    npm run dev
    ;;
esac

