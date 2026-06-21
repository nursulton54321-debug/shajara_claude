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
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
