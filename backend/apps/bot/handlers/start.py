"""
/start handler:
  - Yangi foydalanuvchi → ism so'raydi → adminga xabar
  - Allaqachon tasdiqlangan → asosiy menyu
  - Rad etilgan → xabar
"""
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ContextTypes, ConversationHandler, CommandHandler,
    MessageHandler, filters, CallbackQueryHandler,
)

from apps.bot.models import TelegramUser, BotInvite
from apps.bot.keyboards import main_menu_keyboard, admin_menu_keyboard

logger = logging.getLogger(__name__)

WAITING_NAME = 1


async def _get_tg_user(telegram_id: int):
    """TelegramUser ni user bilan birga yuklash (async)."""
    try:
        return await TelegramUser.objects.select_related('user').aget(
            telegram_id=telegram_id
        )
    except TelegramUser.DoesNotExist:
        return None


def _is_admin(tg_user: TelegramUser) -> bool:
    """user allaqachon select_related bilan yuklangan bo'lishi shart."""
    if not tg_user.user:
        return False
    return tg_user.user.is_superuser or tg_user.user.role == 'admin'


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    /start [token] — kirish nuqtasi.
    Admin → darhol menyu.
    Tasdiqlangan user → darhol menyu.
    Yangi → invite tekshirib ism so'raydi.
    """
    tg_id   = update.effective_user.id
    tg_name = update.effective_user.full_name or update.effective_user.username or ''

    tg_user = await _get_tg_user(tg_id)

    # ── Allaqachon tasdiqlangan ──────────────────────────────────
    if tg_user and tg_user.is_approved:
        is_admin  = _is_admin(tg_user)
        kb        = admin_menu_keyboard() if is_admin else main_menu_keyboard()
        role_icon = "👑 Admin" if is_admin else "👤 A'zo"
        await update.message.reply_text(
            f"🌳 *Shajara Botiga Xush Kelibsiz!*\n\n"
            f"Salom, *{tg_user.full_name}*!\n"
            f"Rol: {role_icon}\n\n"
            f"_Quyidagi bo'limlardan birini tanlang:_",
            parse_mode='Markdown',
            reply_markup=kb,
        )
        return ConversationHandler.END

    # ── Rad etilgan ──────────────────────────────────────────────
    if tg_user and tg_user.status == TelegramUser.STATUS_REJECTED:
        await update.message.reply_text(
            "Sizning so'rovingiz rad etilgan.\n"
            "Qo'shimcha ma'lumot uchun admin bilan bog'laning."
        )
        return ConversationHandler.END

    # ── Kutilmoqda ───────────────────────────────────────────────
    if tg_user and tg_user.status == TelegramUser.STATUS_PENDING:
        await update.message.reply_text(
            "Sizning so'rovingiz admin tomonidan ko'rib chiqilmoqda.\n"
            "Tasdiqlangach xabar keladi."
        )
        return ConversationHandler.END

    # ── Yangi foydalanuvchi — invite tekshirish ──────────────────
    args        = context.args
    invite_obj  = None

    if args:
        token = args[0]
        if token.startswith('INV_'):
            token = token[4:]
        try:
            invite_obj = await BotInvite.objects.select_related('created_by').aget(
                token=token, is_used=False
            )
            if not invite_obj.is_valid:
                invite_obj = None
        except BotInvite.DoesNotExist:
            invite_obj = None

    if args and invite_obj is None:
        await update.message.reply_text(
            "Invite link noto'g'ri yoki muddati tugagan.\n"
            "Admin bilan bog'laning."
        )
        return ConversationHandler.END

    if invite_obj is None:
        await update.message.reply_text(
            "Bu bot faqat invite link orqali ishlaydi.\n"
            "Admin sizga maxsus link yuborishi kerak."
        )
        return ConversationHandler.END

    context.user_data['invite_token'] = invite_obj.token
    context.user_data['tg_name']      = tg_name

    first_name = update.effective_user.first_name or tg_name or "Mehmon"

    welcome = (
        "\n\n\n"
        "              🌳\n\n"
        f"*Assalomu alaykum, {first_name}\\!*\n\n"
        "⸻⸻⸻⸻⸻⸻\n\n"
        "         *Xush kelibsiz*\n"
        "  *Matayev & Abdumannonovlar*\n"
        "         *SHAJARASI*ga\\!\n\n"
        "⸻⸻⸻⸻⸻⸻\n\n"
        "👨‍👩‍👧‍👦  _Oila tariximizni birga saqlaymiz_\n\n\n"
        "📝 *Davom etish uchun*\n"
        "to'liq ism va familiyangizni yozing:\n\n"
        "     _Masalan: Nurislom Matayev_\n\n"
        "⚠️  _Haqiqiy ismingizni kiriting —_\n"
        "     _admin tekshiradi_"
    )
    await update.message.reply_text(welcome, parse_mode='MarkdownV2')
    return WAITING_NAME


async def receive_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Foydalanuvchi ismini qabul qilib adminga xabar yuboradi."""
    full_name = update.message.text.strip()

    if len(full_name) < 3:
        await update.message.reply_text(
            "Ism kamida 3 ta harfdan iborat bo'lishi kerak. Qaytadan kiriting:"
        )
        return WAITING_NAME

    if len(full_name) > 100:
        await update.message.reply_text("Ism juda uzun. Qaytadan kiriting:")
        return WAITING_NAME

    tg_id        = update.effective_user.id
    tg_name      = context.user_data.get('tg_name', '')
    invite_token = context.user_data.get('invite_token')

    try:
        invite_obj = await BotInvite.objects.select_related('created_by').aget(
            token=invite_token
        )
    except BotInvite.DoesNotExist:
        await update.message.reply_text("Xatolik yuz berdi. /start dan boshlang.")
        return ConversationHandler.END

    # TelegramUser yaratish yoki yangilash (pending holat)
    tg_user, created = await TelegramUser.objects.aget_or_create(
        telegram_id=tg_id,
        defaults={
            'telegram_name': tg_name,
            'full_name':     full_name,
            'invited_by':    invite_obj.created_by,
            'status':        TelegramUser.STATUS_PENDING,
        }
    )
    if not created:
        tg_user.full_name     = full_name
        tg_user.telegram_name = tg_name
        tg_user.invited_by    = invite_obj.created_by
        tg_user.status        = TelegramUser.STATUS_PENDING
        await tg_user.asave()

    # Invite tokenni ishlatilgan deb belgilash
    invite_obj.is_used = True
    invite_obj.used_by = tg_user
    await invite_obj.asave()

    # Foydalanuvchiga tasdiqlash kutilmoqda xabari
    await update.message.reply_text(
        f"✅ *So'rovingiz Yuborildi!*\n\n"
        f"Salom, *{full_name}*!\n\n"
        "⏳ Admin tasdiqlashini kuting.\n"
        "Tasdiqlangandan so'ng darhol xabar keladi 🔔",
        parse_mode='Markdown',
    )

    # Barcha adminlarga xabar yuborish
    await _notify_admins(context, tg_user)

    return ConversationHandler.END


async def _notify_admins(context: ContextTypes.DEFAULT_TYPE, tg_user: TelegramUser):
    """Barcha tasdiqlangan admin TelegramUserlarga so'rov xabarini yuboradi."""
    text = (
        f"🔔 *Yangi A'zolik So'rovi*\n"
        f"━━━━━━━━━━━━━━━\n\n"
        f"👤 Ism: *{tg_user.full_name}*\n"
        f"🆔 Telegram ID: `{tg_user.telegram_id}`"
        + (f"\n💬 Login: @{tg_user.telegram_name}" if tg_user.telegram_name else "")
        + f"\n\nBu shaxsni shajara botiga qabul qilasizmi?"
    )
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("Tasdiqlash", callback_data=f"approve_{tg_user.telegram_id}"),
        InlineKeyboardButton("Rad etish",  callback_data=f"reject_{tg_user.telegram_id}"),
    ]])

    # Faqat approved + admin/superuser TelegramUserlar
    async for admin in TelegramUser.objects.select_related('user').filter(
        status=TelegramUser.STATUS_APPROVED
    ):
        if not _is_admin(admin):
            continue
        try:
            await context.bot.send_message(
                chat_id=admin.telegram_id,
                text=text,
                parse_mode='Markdown',
                reply_markup=kb,
            )
        except Exception as e:
            logger.warning(f"Admin {admin.telegram_id} ga xabar yuborib bo'lmadi: {e}")


async def approve_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin Tasdiqlash bosdi."""
    query        = update.callback_query
    await query.answer()
    admin_tg_id  = query.from_user.id
    target_tg_id = int(query.data.split('_')[1])

    admin_tg_user = await _get_tg_user(admin_tg_id)
    if not admin_tg_user or not _is_admin(admin_tg_user):
        await query.answer("Sizda admin huquqi yo'q.", show_alert=True)
        return

    tg_user = await _get_tg_user(target_tg_id)
    if not tg_user:
        await query.edit_message_text("Foydalanuvchi topilmadi.")
        return

    if tg_user.is_approved:
        await query.edit_message_text(f"{tg_user.full_name} allaqachon tasdiqlangan.")
        return

    await tg_user.aapprove(approved_by=admin_tg_user)

    await query.edit_message_text(
        f"✅ *{tg_user.full_name}* muvaffaqiyatli tasdiqlandi!\n"
        f"👑 Admin: {admin_tg_user.full_name}",
        parse_mode='Markdown',
    )

    try:
        await context.bot.send_message(
            chat_id=target_tg_id,
            text=(
                f"🎉 *Tabriklaymiz, {tg_user.full_name}!*\n\n"
                f"Admin sizni shajara botiga qabul qildi.\n\n"
                f"🌳 Endi oilangiz shajara daraxtini ko'rish,\n"
                f"➕ yangi a'zolar qo'shish va\n"
                f"📊 statistika ko'rish imkoniyatiga egasiz!\n\n"
                f"_Quyidagi menyudan boshlang_ 👇"
            ),
            parse_mode='Markdown',
            reply_markup=main_menu_keyboard(),
        )
    except Exception as e:
        logger.warning(f"Foydalanuvchi {target_tg_id} ga xabar yuborib bo'lmadi: {e}")


async def reject_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin Rad etish bosdi."""
    query        = update.callback_query
    await query.answer()
    admin_tg_id  = query.from_user.id
    target_tg_id = int(query.data.split('_')[1])

    admin_tg_user = await _get_tg_user(admin_tg_id)
    if not admin_tg_user or not _is_admin(admin_tg_user):
        await query.answer("Sizda admin huquqi yo'q.", show_alert=True)
        return

    tg_user = await _get_tg_user(target_tg_id)
    if not tg_user:
        await query.edit_message_text("Foydalanuvchi topilmadi.")
        return

    await tg_user.areject()

    await query.edit_message_text(
        f"❌ *{tg_user.full_name}* so'rovi rad etildi.\n"
        f"👑 Admin: {admin_tg_user.full_name}",
        parse_mode='Markdown',
    )

    try:
        await context.bot.send_message(
            chat_id=target_tg_id,
            text=(
                "😔 Afsuski, so'rovingiz rad etildi.\n\n"
                "Qo'shimcha ma'lumot yoki savol uchun\n"
                "admin bilan to'g'ridan-to'g'ri bog'laning."
            ),
        )
    except Exception as e:
        logger.warning(f"Rad xabari yuborib bo'lmadi: {e}")


def get_start_conversation():
    return ConversationHandler(
        entry_points=[CommandHandler('start', start)],
        states={
            WAITING_NAME: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, receive_name)
            ],
        },
        fallbacks=[CommandHandler('start', start)],
        per_chat=True,
        persistent=True,
        name='start_conv',
    )
