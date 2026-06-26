"""
Bot ishga tushirish — polling rejimi.
"""
import logging
import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from telegram import Update
from telegram.ext import Application, CallbackQueryHandler, MessageHandler, filters, ContextTypes
from django.conf import settings

from apps.bot.handlers.start import get_start_conversation, approve_callback, reject_callback, receive_name_db
from apps.bot.handlers.add_person import (
    get_add_person_conversation,
    addp_approve_callback,
    addp_reject_callback,
)
from apps.bot.handlers.menu import (
    handle_stats, handle_dashboard, handle_persons, handle_my_profile,
    handle_invite, handle_users, handle_web, handle_reminders, handle_tree,
    persons_page_callback, person_detail_callback,
    persons_filter_open_callback, persons_filter_callback, _persons_list_msg as persons_filter_list,
    edit_select_callback, edit_field_callback, edit_field_text_handler, edit_cancel_callback,
    edit_val_callback,
    delete_person_callback, confirm_delete_callback,
    back_main_callback, back_persons_callback,
    user_msg_callback, user_warn_callback, user_block_callback,
    user_send_msg_text_handler,
    edit_photo_handler, edit_photo_delete_callback,
    reminders_filter_callback, reminders_person_callback,
)

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


async def _scheduler_post_init(application):
    from apps.bot.scheduler import start_scheduler
    start_scheduler(application.bot)


def build_app():
    token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN settings.py da yo'q!")

    from telegram.request import HTTPXRequest
    request = HTTPXRequest(
        connect_timeout=30,
        read_timeout=60,
        write_timeout=60,
        media_write_timeout=120,
    )
    app = Application.builder().token(token).request(request).post_init(_scheduler_post_init).build()

    # /start va shaxs qo'shish ConversationHandlerlar (birinchi)
    app.add_handler(get_start_conversation())
    app.add_handler(get_add_person_conversation())

    # Foydalanuvchi tasdiqlash/rad etish (admin)
    app.add_handler(CallbackQueryHandler(approve_callback,       pattern=r'^approve_\d+$'))
    app.add_handler(CallbackQueryHandler(reject_callback,        pattern=r'^reject_\d+$'))

    # Shaxs so'rovi (admin)
    app.add_handler(CallbackQueryHandler(addp_approve_callback,  pattern=r'^addp_approve_'))
    app.add_handler(CallbackQueryHandler(addp_reject_callback,   pattern=r'^addp_reject_'))

    # Shaxslar ro'yxati
    app.add_handler(CallbackQueryHandler(persons_page_callback,        pattern=r'^persons_page_\d+$'))
    app.add_handler(CallbackQueryHandler(person_detail_callback,       pattern=r'^person_\d+$'))
    app.add_handler(CallbackQueryHandler(persons_filter_open_callback, pattern=r'^pf_open$'))
    app.add_handler(CallbackQueryHandler(persons_filter_callback,      pattern=r'^pf_'))

    # Tahrirlash
    app.add_handler(CallbackQueryHandler(edit_select_callback,   pattern=r'^edit_select_\d+$'))
    app.add_handler(CallbackQueryHandler(edit_field_callback,    pattern=r'^edit_field_\d+_'))
    app.add_handler(CallbackQueryHandler(edit_cancel_callback,   pattern=r'^edit_cancel_\d+$'))
    app.add_handler(CallbackQueryHandler(edit_val_callback,      pattern=r'^edit_val_'))

    # O'chirish
    app.add_handler(CallbackQueryHandler(delete_person_callback,  pattern=r'^delete_\d+$'))
    app.add_handler(CallbackQueryHandler(confirm_delete_callback, pattern=r'^confirm_delete_\d+$'))

    # Navigatsiya
    app.add_handler(CallbackQueryHandler(back_main_callback,    pattern=r'^back_main$'))
    app.add_handler(CallbackQueryHandler(back_persons_callback, pattern=r'^back_persons$'))

    # Rasm o'chirish
    app.add_handler(CallbackQueryHandler(edit_photo_delete_callback, pattern=r'^edit_photo_del_\d+$'))

    # Eslatmalar filtri va shaxs detali
    app.add_handler(CallbackQueryHandler(reminders_filter_callback, pattern=r'^remf_'))
    app.add_handler(CallbackQueryHandler(reminders_person_callback, pattern=r'^remp_'))

    # Foydalanuvchi amallar (admin)
    app.add_handler(CallbackQueryHandler(user_msg_callback,   pattern=r'^umsg_\d+$'))
    app.add_handler(CallbackQueryHandler(user_warn_callback,  pattern=r'^uwarn_\d+$'))
    app.add_handler(CallbackQueryHandler(user_block_callback, pattern=r'^ublock_\d+$'))

    # Rasm yuborish — tahrirlash oqimida
    app.add_handler(MessageHandler(filters.PHOTO, _dispatch_photo))

    # Tahrirlash uchun matn — ConversationHandlerdan tashqari (global)
    app.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND & filters.Regex(r'^(?!.*➕ Shaxs)'),
        _dispatch_text,
    ))

    return app


async def _dispatch_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Rasm xabarlarini tahrirlash oqimiga yo'naltiradi."""
    if context.user_data.get('awaiting_photo'):
        await edit_photo_handler(update, context)


async def _dispatch_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Matn xabarlarni to'g'ri handlerga yo'naltiradi."""
    text = update.message.text.strip() if update.message.text else ''

    # ── Invite orqali ism kutilayotgan foydalanuvchi (DB holati) ──
    tg_id = update.effective_user.id if update.effective_user else None
    if tg_id:
        from apps.bot.models import TelegramUser
        try:
            _tgu = await TelegramUser.objects.aget(telegram_id=tg_id)
            if _tgu.awaiting_invite_token:
                await receive_name_db(update, context)
                return
        except TelegramUser.DoesNotExist:
            pass

    # Admin xabar yuborish kutilmoqda
    if context.user_data.get('send_msg_to'):
        await user_send_msg_text_handler(update, context)
        return

    # Tahrirlash kutilmoqda bo'lsa
    if context.user_data.get('awaiting_edit_text'):
        await edit_field_text_handler(update, context)
        return

    # Filtr: yil yoki qidiruv matni kutilmoqda
    if context.user_data.get('awaiting_filter_year'):
        context.user_data.pop('awaiting_filter_year')
        if text and text.isdigit() and 1800 <= int(text) <= 2100:
            context.user_data.setdefault('persons_filter', {})['birth_year'] = text
        await persons_filter_list(update, context)
        return

    if context.user_data.get('awaiting_filter_search'):
        context.user_data.pop('awaiting_filter_search')
        if text:
            context.user_data.setdefault('persons_filter', {})['search'] = text
        await persons_filter_list(update, context)
        return

    # Menyu tugmalari
    handlers = {
        '👥 Shaxslar':            handle_persons,
        '📈 Statistika':          handle_stats,
        '📊 Dashboard':           handle_dashboard,
        '👤 Foydalanuvchilar':    handle_users,
        '🔔 Eslatmalar':          handle_reminders,
        '🌳 Shajara daraxti':     handle_tree,
        '🔗 Invite link':         handle_invite,
        "🌐 Veb saytga o'tish":   handle_web,
        '👤 Mening profilim':     handle_my_profile,
    }
    fn = handlers.get(text)
    if fn:
        await fn(update, context)


def run_polling():
    app = build_app()
    logger.info("Bot polling rejimida ishga tushdi...")
    app.run_polling(allowed_updates=['message', 'callback_query'])


if __name__ == '__main__':
    run_polling()
