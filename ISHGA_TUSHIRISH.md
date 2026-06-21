# Loyihani ishga tushirish

## 1. Backend (Django)

```bash
cd backend
python -m venv venv
venv\Scripts\activate         # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser   # admin yaratish (role=admin deb kiriting)
python manage.py runserver
```

## 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

## Manzillar
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/
- Django admin: http://localhost:8000/django-admin/

## Admin yaratish (database orqali)
createsuperuser bilan yaratilgan foydalanuvchi django admin uchun.
Sayt uchun admin: Django shell orqali role='admin' qiling:

```bash
python manage.py shell
>>> from apps.users.models import User
>>> u = User.objects.get(username='your_username')
>>> u.role = 'admin'
>>> u.save()
```
