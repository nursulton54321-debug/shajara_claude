"""
Telegram webhook view — polling o'rniga webhook rejimi.
Global persistent app + background event loop — ConversationHandler holati saqlanadi.
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

# ── Global bot event loop va app (bir marta yaratiladi) ──────────────────────
_bot_loop: asyncio.AbstractEventLoop | None = None
_bot_loop_thread: threading.Thread | None = None
_bot_app = None
_bot_lock = threading.Lock()


def _get_bot_loop() -> asyncio.AbstractEventLoop:
    """Fon threadda doimiy ishlaydigan event loop. Thread o'lsa qayta yaratadi."""
    global _bot_loop, _bot_loop_thread, _bot_app
    if (_bot_loop is None or _bot_loop.is_closed()
            or _bot_loop_thread is None or not _bot_loop_thread.is_alive()):
        if _bot_loop and not _bot_loop.is_closed():
            try:
                _bot_loop.call_soon_threadsafe(_bot_loop.stop)
            except Exception:
                pass
        _bot_loop = asyncio.new_event_loop()
        _bot_loop_thread = threading.Thread(target=_bot_loop.run_forever, daemon=True, name='bot-loop')
        _bot_loop_thread.start()
        _bot_app = None  # loop yangilandi — app ham qayta yaratilsin
        logger.info("[Bot] background event loop (re)started")
    return _bot_loop


def _ensure_app():
    """Global Application — bir marta init, keyin qayta ishlatiladi."""
    global _bot_app
    if _bot_app is not None:
        return _bot_app
    with _bot_lock:
        if _bot_app is not None:
            return _bot_app
        from telegram.ext import Application

        async def _build():
            token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
            app = (
                Application.builder()
                .token(token)
                .updater(None)
                .job_queue(None)
                .build()
            )
            _register_handlers(app)
            await app.initialize()
            logger.info("[Bot] global app initialized")
            return app

        loop = _get_bot_loop()
        future = asyncio.run_coroutine_threadsafe(_build(), loop)
        try:
            _bot_app = future.result(timeout=30)
        except Exception as e:
            logger.error(f"[Bot] app init xato: {e}", exc_info=True)
            _bot_app = None
    return _bot_app


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

    try:
        from telegram import Update

        app = _ensure_app()
        if app is None:
            return JsonResponse({'error': 'bot ishga tushmadi'}, status=500)

        loop = _get_bot_loop()

        async def process():
            update = Update.de_json(data, app.bot)
            await app.process_update(update)

        future = asyncio.run_coroutine_threadsafe(process(), loop)
        future.result(timeout=30)

    except Exception as e:
        logger.error(f"[Bot] update xato: {e}", exc_info=True)
        return JsonResponse({'error': str(e)[:200]}, status=500)

    return JsonResponse({'ok': True})


def _register_handlers(app):
    """Barcha handlerlarni ro'yxatdan o'tkazish."""
    from telegram.ext import CallbackQueryHandler, MessageHandler, filters
    from apps.bot.handlers.start import get_start_conversation, approve_callback, reject_callback
    from apps.bot.handlers.add_person import (
        get_add_person_conversation, addp_approve_callback, addp_reject_callback,
    )
    from apps.bot.handlers.menu import (
        handle_stats, handle_dashboard, handle_persons, handle_my_profile,
        handle_invite, handle_users, handle_web, handle_reminders, handle_tree,
        persons_page_callback, person_detail_callback,
        persons_filter_open_callback, persons_filter_callback, _persons_list_msg as persons_filter_list,
        edit_select_callback, edit_field_callback, edit_field_text_handler, edit_cancel_callback,
        delete_person_callback, confirm_delete_callback,
        back_main_callback, back_persons_callback,
        user_msg_callback, user_warn_callback, user_block_callback,
        user_send_msg_text_handler,
        edit_photo_handler, edit_photo_delete_callback,
        reminders_filter_callback, reminders_person_callback,
    )

    from telegram.ext import CommandHandler as CmdHandler
    app.add_handler(get_start_conversation())
    app.add_handler(get_add_person_conversation())
    app.add_handler(CmdHandler('fix_photos', _fix_photos_cmd))
    app.add_handler(CallbackQueryHandler(approve_callback,       pattern=r'^approve_\d+$'))
    app.add_handler(CallbackQueryHandler(reject_callback,        pattern=r'^reject_\d+$'))
    app.add_handler(CallbackQueryHandler(addp_approve_callback,  pattern=r'^addp_approve_'))
    app.add_handler(CallbackQueryHandler(addp_reject_callback,   pattern=r'^addp_reject_'))
    app.add_handler(CallbackQueryHandler(persons_page_callback,        pattern=r'^persons_page_\d+$'))
    app.add_handler(CallbackQueryHandler(person_detail_callback,       pattern=r'^person_\d+$'))
    app.add_handler(CallbackQueryHandler(persons_filter_open_callback, pattern=r'^pf_open$'))
    app.add_handler(CallbackQueryHandler(persons_filter_callback,      pattern=r'^pf_'))
    app.add_handler(CallbackQueryHandler(edit_select_callback,   pattern=r'^edit_select_\d+$'))
    app.add_handler(CallbackQueryHandler(edit_field_callback,    pattern=r'^edit_field_\d+_'))
    app.add_handler(CallbackQueryHandler(edit_cancel_callback,   pattern=r'^edit_cancel_\d+$'))
    app.add_handler(CallbackQueryHandler(delete_person_callback,  pattern=r'^delete_\d+$'))
    app.add_handler(CallbackQueryHandler(confirm_delete_callback, pattern=r'^confirm_delete_\d+$'))
    app.add_handler(CallbackQueryHandler(back_main_callback,    pattern=r'^back_main$'))
    app.add_handler(CallbackQueryHandler(back_persons_callback, pattern=r'^back_persons$'))
    app.add_handler(CallbackQueryHandler(edit_photo_delete_callback, pattern=r'^edit_photo_del_\d+$'))
    app.add_handler(CallbackQueryHandler(reminders_filter_callback, pattern=r'^remf_'))
    app.add_handler(CallbackQueryHandler(reminders_person_callback, pattern=r'^remp_'))
    app.add_handler(CallbackQueryHandler(user_msg_callback,   pattern=r'^umsg_\d+$'))
    app.add_handler(CallbackQueryHandler(user_warn_callback,  pattern=r'^uwarn_\d+$'))
    app.add_handler(CallbackQueryHandler(user_block_callback, pattern=r'^ublock_\d+$'))
    app.add_handler(MessageHandler(filters.PHOTO, _dispatch_photo))
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND & filters.Regex(r'^(?!.*➕ Shaxs)'),
        _dispatch_text,
    ))


async def _fix_photos_cmd(update, context):
    """
    /fix_photos — faqat admin: photo_url bo'sh, photo bor shaxslarni
    ImageKit ga qayta yuklaydi (bir martalik tuzatish).
    """
    from apps.bot.models import TelegramUser
    from apps.bot.handlers.start import _is_admin
    tg_id = update.effective_user.id
    try:
        tg_user = await TelegramUser.objects.select_related('user').aget(telegram_id=tg_id)
    except TelegramUser.DoesNotExist:
        return
    if not _is_admin(tg_user):
        await update.message.reply_text("❌ Ruxsat yo'q.")
        return

    from apps.persons.models import Person
    from apps.persons.views import _upload_to_imagekit
    import asyncio

    await update.message.reply_text("⏳ Rasmlar ImageKit ga yuklanmoqda...")
    fixed, failed, skipped = 0, 0, 0

    async for person in Person.objects.filter(photo_url='').exclude(photo=''):
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, _upload_to_imagekit, person)
            if person.photo_url:
                fixed += 1
            else:
                failed += 1
        except Exception as e:
            logger.warning(f"fix_photos: person {person.id}: {e}")
            failed += 1

    # photo_url bor bo'lmagan va photo ham bo'lmagan — skip
    skipped = await Person.objects.filter(photo_url='', photo='').acount()

    await update.message.reply_text(
        f"✅ Tuzatildi: {fixed}\n"
        f"❌ Xato: {failed}\n"
        f"⏭️ Rasmsiz: {skipped}"
    )


async def _dispatch_photo(update, context):
    from apps.bot.handlers.menu import edit_photo_handler
    if context.user_data.get('awaiting_photo'):
        await edit_photo_handler(update, context)


async def _dispatch_text(update, context):
    from apps.bot.handlers.menu import (
        handle_stats, handle_dashboard, handle_persons, handle_my_profile,
        handle_invite, handle_users, handle_web, handle_reminders, handle_tree,
        _persons_list_msg as persons_filter_list,
        edit_field_text_handler, user_send_msg_text_handler,
    )
    text = update.message.text.strip() if update.message else ''

    # ── Invite orqali ism kutilayotgan foydalanuvchi (DB holati) ──
    tg_id = update.effective_user.id if update.effective_user else None
    if tg_id:
        from apps.bot.models import TelegramUser
        from apps.bot.handlers.start import receive_name_db
        try:
            _tgu = await TelegramUser.objects.aget(telegram_id=tg_id)
            if _tgu.awaiting_invite_token:
                await receive_name_db(update, context)
                return
        except TelegramUser.DoesNotExist:
            pass

    if context.user_data.get('send_msg_to'):
        await user_send_msg_text_handler(update, context); return
    if context.user_data.get('awaiting_edit_text'):
        await edit_field_text_handler(update, context); return
    if context.user_data.get('awaiting_filter_year'):
        context.user_data.pop('awaiting_filter_year')
        if text and text.isdigit() and 1800 <= int(text) <= 2100:
            context.user_data.setdefault('persons_filter', {})['birth_year'] = text
        await persons_filter_list(update, context); return
    if context.user_data.get('awaiting_filter_search'):
        context.user_data.pop('awaiting_filter_search')
        if text:
            context.user_data.setdefault('persons_filter', {})['search'] = text
        await persons_filter_list(update, context); return
    handlers = {
        '👥 Shaxslar': handle_persons, '📈 Statistika': handle_stats,
        '📊 Dashboard': handle_dashboard, '👤 Foydalanuvchilar': handle_users,
        '🔔 Eslatmalar': handle_reminders, '🌳 Shajara daraxti': handle_tree,
        '🔗 Invite link': handle_invite, "🌐 Veb saytga o'tish": handle_web,
        '👤 Mening profilim': handle_my_profile,
    }
    fn = handlers.get(text)
    if fn:
        await fn(update, context)


def set_webhook(request):
    """GET /api/bot/set-webhook/ — avval o'chirib, keyin qayta ro'yxatdan o'tkazish."""
    import urllib.request, urllib.parse, os
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    if not token:
        return JsonResponse({'error': 'TELEGRAM_BOT_TOKEN yo\'q'}, status=400)
    backend_url = (
        getattr(settings, 'BACKEND_URL', '')
        or os.environ.get('RENDER_EXTERNAL_URL', '')
        or os.environ.get('BACKEND_URL', '')
    ).rstrip('/')
    if not backend_url:
        return JsonResponse({'error': 'BACKEND_URL topilmadi'}, status=400)
    webhook_url = f"{backend_url}/api/bot/webhook/"

    api = f"https://api.telegram.org/bot{token}"
    try:
        del_url = f"{api}/deleteWebhook?drop_pending_updates=true"
        with urllib.request.urlopen(del_url, timeout=10) as r:
            del_result = json.loads(r.read())
        logger.info(f"[Bot] deleteWebhook: {del_result}")

        set_url = (f"{api}/setWebhook"
                   f"?url={urllib.parse.quote(webhook_url, safe='')}"
                   f"&allowed_updates=%5B%22message%22%2C%22callback_query%22%5D"
                   f"&drop_pending_updates=true")
        with urllib.request.urlopen(set_url, timeout=10) as r:
            result = json.loads(r.read())
        logger.info(f"[Bot] setWebhook: {result} → {webhook_url}")
        result['webhook_url'] = webhook_url
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def webhook_info(request):
    """GET /api/bot/webhook-info/ — Telegram dan webhook holati va oxirgi xatoni ko'rish."""
    import urllib.request
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    if not token:
        return JsonResponse({'error': 'token yo\'q'}, status=400)
    try:
        url = f"https://api.telegram.org/bot{token}/getWebhookInfo"
        with urllib.request.urlopen(url, timeout=10) as r:
            result = json.loads(r.read())
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
