"""
Telegram webhook view — polling o'rniga webhook rejimi.
Render.com free tier uchun: alohida process shart emas.
"""
import json
import logging
import asyncio
import threading

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.conf import settings

logger = logging.getLogger(__name__)

_app = None
_app_lock = threading.Lock()


def _get_app():
    global _app
    if _app is not None:
        return _app
    with _app_lock:
        if _app is not None:
            return _app
        try:
            from apps.bot.bot import build_app
            _app = build_app()
            asyncio.run(_app.initialize())
            logger.info("[Bot] Application initialized (webhook mode)")
        except Exception as e:
            logger.error(f"[Bot] init xato: {e}")
            _app = None
    return _app


@csrf_exempt
@require_POST
def telegram_webhook(request):
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    if not token:
        return JsonResponse({'error': 'token yo\'q'}, status=400)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({'error': 'JSON xato'}, status=400)

    app = _get_app()
    if app is None:
        return JsonResponse({'error': 'bot init xato'}, status=500)

    try:
        from telegram import Update

        async def process():
            update = Update.de_json(data, app.bot)
            await app.process_update(update)

        asyncio.run(process())
    except Exception as e:
        logger.error(f"[Bot] update xato: {e}")

    return JsonResponse({'ok': True})


def set_webhook(request):
    """GET /api/bot/set-webhook/ — webhookni Telegram ga ro'yxatdan o'tkazish."""
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    backend_url = getattr(settings, 'WEB_BASE_URL', '').rstrip('/')
    if not token or not backend_url:
        return JsonResponse({'error': 'TELEGRAM_BOT_TOKEN yoki WEB_BASE_URL yo\'q'}, status=400)

    webhook_url = f"{backend_url}/api/bot/webhook/"

    import urllib.request
    url = f"https://api.telegram.org/bot{token}/setWebhook?url={webhook_url}&allowed_updates=%5B%22message%22%2C%22callback_query%22%5D"
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            result = json.loads(r.read())
        logger.info(f"[Bot] setWebhook: {result}")
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
