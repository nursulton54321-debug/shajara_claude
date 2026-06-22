from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse


def health_check(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('api/health/', health_check),
    path('django-admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/persons/', include('apps.persons.urls')),
    path('api/bot/webhook/', __import__('apps.bot.views', fromlist=['telegram_webhook']).telegram_webhook),
    path('api/bot/set-webhook/', __import__('apps.bot.views', fromlist=['set_webhook']).set_webhook),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
