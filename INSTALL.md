# Shajara — Serverga o'rnatish qo'llanmasi

## Talab: Ubuntu 22.04, 1 vCPU, 1 GB RAM (minimal)

---

## 1. Server dastlabki sozlash

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.11 python3.11-venv python3-pip nginx postgresql postgresql-contrib nodejs npm git
```

---

## 2. PostgreSQL bazasi yaratish

```bash
sudo -u postgres psql
```
```sql
CREATE USER shajara_user WITH PASSWORD 'KUCHLI_PAROL';
CREATE DATABASE shajara_db OWNER shajara_user;
\q
```

---

## 3. Loyiha fayllarini yuklash

```bash
sudo mkdir -p /var/www/shajara
sudo chown ubuntu:ubuntu /var/www/shajara
cd /var/www/shajara
git clone https://github.com/SIZNING_USERNAME/shajara.git .
```

---

## 4. Backend sozlash

```bash
cd /var/www/shajara
python3.11 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# .env faylini yaratish
cp backend/.env.example backend/.env
nano backend/.env   # qiymatlarni to'ldiring
```

**SECRET_KEY generatsiya:**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

**Migratsiya va static:**
```bash
cd backend
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser  # admin yaratish
```

---

## 5. Frontend build

```bash
cd /var/www/shajara/frontend
npm install
npm run build
```

---

## 6. Systemd servislar

```bash
# Django (Gunicorn)
sudo cp /var/www/shajara/shajara.service /etc/systemd/system/
# Telegram bot
sudo cp /var/www/shajara/shajara-bot.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable shajara shajara-bot
sudo systemctl start shajara shajara-bot
```

**Holat tekshirish:**
```bash
sudo systemctl status shajara
sudo systemctl status shajara-bot
```

---

## 7. Nginx sozlash

```bash
# Domen nomini o'zgartiring
sudo nano /var/www/shajara/nginx.conf

sudo cp /var/www/shajara/nginx.conf /etc/nginx/sites-available/shajara
sudo ln -s /etc/nginx/sites-available/shajara /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. SSL sertifikat (Let's Encrypt — bepul)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d shajara.uz -d www.shajara.uz
# Avtomatik yangilash (har 90 kun)
sudo systemctl enable certbot.timer
```

---

## 9. Keyingi yangilashlar

```bash
cd /var/www/shajara
chmod +x deploy.sh
./deploy.sh
```

---

## Log ko'rish

```bash
sudo journalctl -u shajara -f         # Django log
sudo journalctl -u shajara-bot -f     # Bot log
sudo tail -f /var/log/nginx/error.log # Nginx log
```
