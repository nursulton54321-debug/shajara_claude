from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from apps.bot.views import telegram_webhook, set_webhook, webhook_info


def health_check(request):
    """
    Ping endpoint — UptimeRobot yoki boshqa monitoring xizmati tomonidan
    har 5 daqiqada chaqiriladi. Bot app ni ham ishga tushiradi (warm-up).
    """
    bot_status = 'ok'
    try:
        from apps.bot.views import _ensure_app, _bot_app
        if _bot_app is None:
            _ensure_app()
            bot_status = 'warmed_up'
    except Exception as e:
        bot_status = f'warn:{str(e)[:60]}'
    return JsonResponse({'status': 'ok', 'bot': bot_status})


urlpatterns = [
    path('api/health/', health_check),
    path('django-admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/persons/', include('apps.persons.urls')),
    path('api/bot/webhook/', telegram_webhook),
    path('api/bot/set-webhook/', set_webhook),
    path('api/bot/webhook-info/', webhook_info),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
