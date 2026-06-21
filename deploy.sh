#!/bin/bash
# ════════════════════════════════════════════════════════════════
#  deploy.sh — Serverdagi yangilash skripti
#  Ishlatish: ./deploy.sh
#  (Birinchi o'rnatish uchun: INSTALL.md ni o'qing)
# ════════════════════════════════════════════════════════════════
set -e

PROJECT_DIR="/var/www/shajara"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
VENV="$PROJECT_DIR/venv"

echo "🚀 Deploy boshlandi: $(date)"

# ── Kodni yangilash ──────────────────────────────────────────────
echo "📥 Git pull..."
cd $PROJECT_DIR
git pull origin main

# ── Backend ──────────────────────────────────────────────────────
echo "🐍 Backend yangilanmoqda..."
cd $BACKEND_DIR
$VENV/bin/pip install -r requirements.txt --quiet

echo "📦 Migratsiyalar..."
$VENV/bin/python manage.py migrate --noinput

echo "🗂️  Static fayllar..."
$VENV/bin/python manage.py collectstatic --noinput --clear

# ── Frontend ─────────────────────────────────────────────────────
echo "⚛️  Frontend build..."
cd $FRONTEND_DIR
npm ci --silent
npm run build

# ── Servislarni qayta ishga tushirish ────────────────────────────
echo "🔄 Servislar qayta ishga tushmoqda..."
sudo systemctl restart shajara
sudo systemctl restart shajara-bot
sudo systemctl reload nginx

echo "✅ Deploy muvaffaqiyatli yakunlandi: $(date)"
