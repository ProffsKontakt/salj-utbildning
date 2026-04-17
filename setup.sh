#!/bin/bash
set -e

echo ""
echo "🚀 Proffskontakt Säljträning — GitHub + Vercel Setup"
echo "======================================================"
echo ""

# ---- 1. GIT INIT ----
if [ ! -d ".git" ]; then
  echo "📁 Initierar Git..."
  git init
  git branch -M main
fi

# ---- 2. GITHUB CLI ----
if ! command -v gh &> /dev/null; then
  echo "📦 Installerar GitHub CLI..."
  brew install gh
fi

if ! gh auth status &> /dev/null 2>&1; then
  echo "🔐 Logga in på GitHub (öppnas i webbläsaren)..."
  gh auth login --web
fi

# ---- 3. SKAPA REPO + PUSHA ----
REPO_NAME="salj-utbildning"
echo ""
echo "📁 Skapar GitHub-repo: $REPO_NAME"

git add -A
git commit -m "Initial commit — Proffskontakt Säljträning" 2>/dev/null || true

gh repo create "$REPO_NAME" --private --source=. --remote=origin --push 2>/dev/null || {
  echo "   Repo finns redan, pushar..."
  git remote set-url origin "$(gh repo view "$REPO_NAME" --json url -q .url).git" 2>/dev/null || \
  git remote add origin "$(gh repo view "$REPO_NAME" --json url -q .url).git" 2>/dev/null || true
  git push -u origin main
}

echo ""
echo "✅ Kod är uppe på GitHub!"

# ---- 4. NODE DEPS ----
echo ""
echo "📦 Installerar dependencies..."
npm install

# ---- 5. VERCEL ----
if ! command -v vercel &> /dev/null; then
  echo "📦 Installerar Vercel CLI..."
  npm install -g vercel
fi

echo ""
echo "☁️  Deployer till Vercel..."
vercel --yes --prod

echo ""
echo "======================================================"
echo "✅ KLART! Appen är live på Vercel."
echo ""
echo "📌 Sätt upp custom domain:"
echo "   1. Gå till https://vercel.com → ditt projekt → Settings → Domains"
echo "   2. Lägg till: utbildning.proffskontakt.se"
echo "   3. I Loopia DNS, lägg till CNAME:"
echo "      utbildning → cname.vercel-dns.com"
echo ""
echo "🔄 Framöver — uppdatera appen:"
echo "   cd ~/Claude\ Cowork/salj-utbildning"
echo "   git add -A && git commit -m 'update' && git push"
echo "   → Vercel deployer automatiskt!"
echo "======================================================"
