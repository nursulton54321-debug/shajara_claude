from pathlib import Path
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-change-this-in-production')
DEBUG = config('DEBUG', default=True, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*', cast=Csv())

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'apps.users',
    'apps.persons',
    'apps.bot',
]

# ── Telegram Bot ────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = config('TELEGRAM_BOT_TOKEN', default='')
WEB_BASE_URL       = config('WEB_BASE_URL', default='https://shajara.uz')
BACKEND_URL        = config('BACKEND_URL', default='')

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates',
               'DIRS': [], 'APP_DIRS': True,
               'OPTIONS': {'context_processors': [
                   'django.template.context_processors.debug',
                   'django.template.context_processors.request',
                   'django.contrib.auth.context_processors.auth',
                   'django.contrib.messages.context_processors.messages',
               ]}}]

_db_url = config('DATABASE_URL', default='')
if _db_url:
    import dj_database_url
    DATABASES = {'default': dj_database_url.parse(_db_url, conn_max_age=600)}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_USER_MODEL = 'users.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}

if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='', cast=Csv())
    CORS_ALLOW_CREDENTIALS = True

# ── 4.4 VAPID (Web Push Notifications) ─────────────────────────
VAPID_PRIVATE_KEY = config('VAPID_PRIVATE_KEY', default=(
    '-----BEGIN PRIVATE KEY-----\n'
    'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg0sAnlwtc9OsG+l9H\n'
    'o7/A+H2CA5b2ivMLGpZZiW0tB7yhRANCAASLut5E8Abc5zT+ZoF88vE7qCe+Bc7g\n'
    'x038c6gnINRXrHyieKi4yjRwSFZNhpyxZbxE3kbL2giWZRY+6DARTjva\n'
    '-----END PRIVATE KEY-----\n'
))
VAPID_PUBLIC_KEY  = config('VAPID_PUBLIC_KEY',  default='BIu63kTwBtznNP5mgXzy8TuoJ74FzuDHTfxzqCcg1FesfKJ4qLjKNHBIVk2GnLFlvETeRsvaCJZlFj7oMBFOO9o')
VAPID_CLAIMS_EMAIL = config('VAPID_CLAIMS_EMAIL', default='admin@shajara.app')
# 11. Cron job secret key (X-Cron-Secret header)
CRON_SECRET = config('CRON_SECRET', default='shajara-cron-2024')
# 15/16. Google Gemini API (bepul: https://aistudio.google.com/app/apikey)
GEMINI_API_KEY = config('GEMINI_API_KEY', default='')
# Groq AI (bepul fallback: https://console.groq.com/keys)
GROQ_API_KEY   = config('GROQ_API_KEY',   default='')

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ImageKit
IMAGEKIT_PRIVATE_KEY = config('IMAGEKIT_PRIVATE_KEY', default='')
IMAGEKIT_PUBLIC_KEY  = config('IMAGEKIT_PUBLIC_KEY',  default='')
IMAGEKIT_URL_ENDPOINT = config('IMAGEKIT_URL_ENDPOINT', default='')

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LANGUAGE_CODE = 'uz'
TIME_ZONE = 'Asia/Tashkent'
USE_TZ = True

# ── Production xavfsizlik sozlamalari ───────────────────────────
if not DEBUG:
    SECURE_PROXY_SSL_HEADER     = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT         = True
    SESSION_COOKIE_SECURE       = True
    CSRF_COOKIE_SECURE          = True
    SECURE_HSTS_SECONDS         = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD         = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS             = 'DENY'

# ── Logging ──────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {'format': '{levelname} {asctime} {module} {message}', 'style': '{'},
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'verbose'},
    },
    'root': {'handlers': ['console'], 'level': 'INFO'},
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'apps':   {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
    },
}
