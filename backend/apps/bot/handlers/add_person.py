"""
Shaxs qo'shish — bosqichma-bosqich ConversationHandler.
- Har bir qadam javobi kiritilganda oldingi bot xabari butunlay o'chiriladi
- Farzand raqami MAJBURIY
- Preview: rasm bo'lsa rasm, bo'lmasa No Photo placeholder
- Adminga yuborishdan oldin preview xabari ham o'chiriladi
- Admin tasdiqlaganida bazaga saqlanadi
"""
import logging, time
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup,
    ReplyKeyboardMarkup, KeyboardButton, ReplyKeyboardRemove,
)
from telegram.ext import (
    ContextTypes, ConversationHandler, CommandHandler,
    MessageHandler, filters, CallbackQueryHandler,
)
from apps.bot.handlers.start import _get_tg_user, _is_admin
from apps.bot.keyboards import main_menu_keyboard, admin_menu_keyboard

logger = logging.getLogger(__name__)

(
    S_LAST_NAME, S_FIRST_NAME, S_MIDDLE_NAME, S_GENDER,
    S_BIRTH_DATE, S_DEATH_DATE, S_CHILD_NUMBER,
    S_BIRTH_PLACE, S_PHONE, S_FATHER, S_MOTHER, S_SPOUSE,
    S_PHOTO, S_CONFIRM,
) = range(14)

CANCEL_TEXT = "❌ Bekor qilish"
SKIP_TEXT   = "⏭️ O'tkazib yuborish"
TOTAL       = 13


# ══════════════════════════════════════════════════════════════════
#  KLAVIATURALAR
# ══════════════════════════════════════════════════════════════════

def _kb_cancel():
    return ReplyKeyboardMarkup([[KeyboardButton(CANCEL_TEXT)]], resize_keyboard=True)

def _kb_skip():
    return ReplyKeyboardMarkup(
        [[KeyboardButton(SKIP_TEXT)], [KeyboardButton(CANCEL_TEXT)]], resize_keyboard=True
    )

def _kb_gender():
    return ReplyKeyboardMarkup(
        [[KeyboardButton("👨 Erkak"), KeyboardButton("👩 Ayol")],
         [KeyboardButton(CANCEL_TEXT)]], resize_keyboard=True, one_time_keyboard=True
    )


# ══════════════════════════════════════════════════════════════════
#  YORDAMCHI
# ══════════════════════════════════════════════════════════════════

def _d(ctx) -> dict:
    ctx.user_data.setdefault('np', {})
    return ctx.user_data['np']

def _parse_date(text: str):
    from datetime import datetime
    for fmt in ('%d.%m.%Y', '%d/%m/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None

async def _delete_step_msg(context, chat_id, step_n: int):
    """Bot savol xabarini chatdan butunlay o'chiradi."""
    msg_id = context.user_data.pop(f'qmsg_{step_n}', None)
    if not msg_id:
        return
    try:
        await context.bot.delete_message(chat_id=chat_id, message_id=msg_id)
    except Exception:
        pass

async def _delete_user_msg(update: Update):
    """Foydalanuvchi yuborgan matn xabarini o'chiradi."""
    try:
        await update.message.delete()
    except Exception:
        pass

async def _delete_all_steps(context, chat_id):
    """Barcha qadam xabarlarini o'chiradi."""
    for i in range(1, TOTAL + 2):
        await _delete_step_msg(context, chat_id, i)

async def _send_step(reply_fn, context, step_n: int, icon: str, title: str, body: str, kb):
    """Qadam xabarini yuboradi va message_id ni saqlaydi."""
    bar  = "🟩" * step_n + "⬜" * (TOTAL - step_n)
    text = (
        f"{icon}  <b>{title}</b>   {bar} <b>{step_n}/{TOTAL}</b>\n"
        f"━━━━━━━━━━━━━━━\n\n"
        f"{body}"
    )
    msg = await reply_fn(text, parse_mode='HTML', reply_markup=kb)
    context.user_data[f'qmsg_{step_n}'] = msg.message_id
    return msg

async def _parent_kb(gender_filter: str, skip_label: str):
    from apps.persons.models import Person
    rows = []
    async for p in Person.objects.filter(gender=gender_filter).order_by('last_name', 'first_name')[:40]:
        icon = '👨' if gender_filter == 'male' else '👩'
        bd   = f" ({p.birth_date.year})" if p.birth_date else ""
        rows.append([InlineKeyboardButton(
            f"{icon} {p.full_name}{bd}", callback_data=f"psel_{p.id}"
        )])
    rows.append([InlineKeyboardButton(f"⏭️ {skip_label}", callback_data="psel_skip")])
    return InlineKeyboardMarkup(rows)

async def _spouse_kb(gender_filter: str):
    from apps.persons.models import Person
    rows = []
    async for p in Person.objects.filter(gender=gender_filter).order_by('last_name', 'first_name')[:40]:
        icon = '👨' if gender_filter == 'male' else '👩'
        bd   = f" ({p.birth_date.year})" if p.birth_date else ""
        rows.append([InlineKeyboardButton(
            f"{icon} {p.full_name}{bd}", callback_data=f"psel_{p.id}"
        )])
    rows.append([InlineKeyboardButton("⏭️ Turmush o'rtog'i yo'q", callback_data="psel_skip")])
    return InlineKeyboardMarkup(rows)


# ══════════════════════════════════════════════════════════════════
#  PREVIEW CAPTION (tekis, chiroyli)
# ══════════════════════════════════════════════════════════════════

def _build_caption(d: dict) -> str:
    g_icon = "👨" if d.get('gender') == 'male' else "👩"
    gender = "Erkak" if d.get('gender') == 'male' else "Ayol"
    status = "Vafot etgan 🌿" if d.get('death_date') else "Tirik 🟢"
    full   = f"{d.get('last_name','')} {d.get('first_name','')} {d.get('middle_name','')}".strip()

    lines = [f"{g_icon} <b>{full}</b>", ""]

    def row(icon, label, value):
        return f"{icon} <b>{label}:</b>  {value}"

    lines.append(row("⚧", "Jins",         f"{g_icon} {gender}"))
    lines.append(row("💫", "Holat",        status))
    if d.get('birth_date'):
        lines.append(row("🎂", "Tug'ilgan", f"<b>{d['birth_date']}</b>"))
    if d.get('death_date'):
        lines.append(row("🕯️", "Vafot",     f"<b>{d['death_date']}</b>"))
    if d.get('birth_place'):
        lines.append(row("📍", "Joyi",      d['birth_place']))
    if d.get('child_number'):
        lines.append(row("🔢", "Farzand",   f"<b>{d['child_number']}-chi</b>"))
    if d.get('phone'):
        lines.append(row("📞", "Tel",       f"<code>{d['phone']}</code>"))

    lines.append("")
    lines.append("👨‍👩‍👧‍👦 <b>Oila aloqalari:</b>")
    lines.append(f"  👨 <b>Otasi:</b>     {d.get('father_name') or '—'}")
    lines.append(f"  👩 <b>Onasi:</b>     {d.get('mother_name') or '—'}")
    lines.append(f"  💍 <b>Juftligi:</b>  {d.get('spouse_name') or '—'}")

    return "\n".join(lines)

CONFIRM_KB = InlineKeyboardMarkup([[
    InlineKeyboardButton("📤 Adminga yuborish", callback_data="addp_submit"),
    InlineKeyboardButton("◀️ Orqaga",           callback_data="addp_back"),
]])

# No-photo placeholder (Telegram'da mavjud sticker file_id yoki URL ishlatilmaydi,
# shuning uchun katta matnli xabar yuboramiz)
async def _show_preview(context, chat_id, send_photo_fn, send_text_fn):
    d             = _d(context)
    caption       = _build_caption(d)
    header        = "🔍 <b>Tekshirib ko'ring:</b>\n\n"
    footer        = "\n\n<i>Hammasi to'g'rimi? Adminga yuborasizmi?</i>"
    full_caption  = header + caption + footer
    photo_file_id = context.user_data.get('np_photo_file_id')

    if photo_file_id:
        msg = await send_photo_fn(
            photo=photo_file_id,
            caption=full_caption,
            parse_mode='HTML',
            reply_markup=CONFIRM_KB,
        )
    else:
        # No photo — matn ko'rinishida chiroyli preview
        no_photo = (
            "📷\n"
            "<i>Rasm yuklanmagan</i>\n\n"
            "─────────────────────\n\n"
        )
        msg = await send_text_fn(
            header + no_photo + caption + footer,
            parse_mode='HTML',
            reply_markup=CONFIRM_KB,
        )
    context.user_data['preview_msg_id'] = msg.message_id
    return S_CONFIRM


# ══════════════════════════════════════════════════════════════════
#  BOSQICHLAR
# ══════════════════════════════════════════════════════════════════

async def add_person_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = await _get_tg_user(update.effective_user.id)
    if not tg_user or not tg_user.is_approved:
        await update.message.reply_text("🔒 Kirish cheklangan.")
        return ConversationHandler.END

    context.user_data['np'] = {}
    context.user_data['np_photo_file_id'] = None
    context.user_data['preview_msg_id']   = None
    for i in range(1, TOTAL + 2):
        context.user_data.pop(f'qmsg_{i}', None)

    intro = await update.message.reply_text(
        "🌱 <b>Yangi A'zo Qo'shish</b>\n"
        "━━━━━━━━━━━━━━━\n\n"
        "Har bir qadamda ma'lumot kiriting.\n"
        "⏭️ — ixtiyoriy maydonni o'tkazib yuborish\n"
        "❌ — istalgan vaqt bekor qilish\n",
        parse_mode='HTML',
        reply_markup=_kb_cancel(),
    )
    context.user_data['intro_msg_id'] = intro.message_id

    await _send_step(
        update.message.reply_text, context, 1, "🏷️", "Familiya",
        "Shaxsning <b>familiyasini</b> kiriting:\n<i>Masalan: Matayev</i>",
        _kb_cancel(),
    )
    return S_LAST_NAME


# ── 1. Familiya ─────────────────────────────────────────────────
async def got_last_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text == CANCEL_TEXT: return await _do_cancel(update, context)
    if len(text) < 2 or len(text) > 60:
        await update.message.reply_text("⚠️ 2–60 ta harf bo'lishi kerak. Qayta kiriting:")
        return S_LAST_NAME
    _d(context)['last_name'] = text
    chat_id = update.effective_chat.id
    await _delete_user_msg(update)
    await _delete_step_msg(context, chat_id, 1)
    await _send_step(
        update.message.reply_text, context, 2, "✨", "Ism",
        "Shaxsning <b>ismini</b> kiriting:\n<i>Masalan: Nurislom</i>",
        _kb_cancel(),
    )
    return S_FIRST_NAME


# ── 2. Ism ──────────────────────────────────────────────────────
async def got_first_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text == CANCEL_TEXT: return await _do_cancel(update, context)
    if len(text) < 2 or len(text) > 60:
        await update.message.reply_text("⚠️ 2–60 ta harf bo'lishi kerak. Qayta kiriting:")
        return S_FIRST_NAME
    _d(context)['first_name'] = text
    chat_id = update.effective_chat.id
    await _delete_user_msg(update)
    await _delete_step_msg(context, chat_id, 2)
    await _send_step(
        update.message.reply_text, context, 3, "👨", "Otasining ismi",
        "Shaxsning <b>otasining ismini</b> kiriting:\n<i>Masalan: Elyorovich</i>\n\n<i>(Ixtiyoriy)</i>",
        _kb_skip(),
    )
    return S_MIDDLE_NAME


# ── 3. Otasining ismi ───────────────────────────────────────────
async def got_middle_name(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text == CANCEL_TEXT: return await _do_cancel(update, context)
    if text != SKIP_TEXT:
        _d(context)['middle_name'] = text[:60]
    chat_id = update.effective_chat.id
    await _delete_user_msg(update)
    await _delete_step_msg(context, chat_id, 3)
    await _send_step(
        update.message.reply_text, context, 4, "⚧", "Jins",
        "Shaxsning <b>jinsini</b> tanlang:",
        _kb_gender(),
    )
    return S_GENDER


# ── 4. Jins ─────────────────────────────────────────────────────
async def got_gender(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text == CANCEL_TEXT: return await _do_cancel(update, context)
    if "Erkak" in text:   _d(context)['gender'] = 'male'
    elif "Ayol" in text:  _d(context)['gender'] = 'female'
    else:
        await update.message.reply_text("⚠️ Tugmalardan birini bosing:", reply_markup=_kb_gender())
        return S_GENDER
    chat_id = update.effective_chat.id
    await _delete_user_msg(update)
    await _delete_step_msg(context, chat_id, 4)
    await _send_step(
        update.message.reply_text, context, 5, "🎂", "Tug'ilgan sana",
        "<b>Tug'ilgan sanasini</b> kiriting:\n<i>Format: KK.OO.YYYY  •  Masalan: 15.03.1975</i>\n\n<i>(Ixtiyoriy)</i>",
        _kb_skip(),
    )
    return S_BIRTH_DATE


# ── 5. Tug'ilgan sana ───────────────────────────────────────────
async def got_birth_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text == CANCEL_TEXT: return await _do_cancel(update, context)
    if text != SKIP_TEXT:
        d = _parse_date(text)
        if not d:
            await update.message.reply_text("⚠️ Format noto'g'ri. KK.OO.YYYY shaklida kiriting:")
            return S_BIRTH_DATE
        from django.utils import timezone
        if d > timezone.now().date():
            await update.message.reply_text("⚠️ Kelajak sana kiritib bo'lmaydi.")
            return S_BIRTH_DATE
        _d(context)['birth_date']     = d.strftime('%d.%m.%Y')
        _d(context)['birth_date_iso'] = d.isoformat()
    chat_id = update.effective_chat.id
    await _delete_user_msg(update)
    await _delete_step_msg(context, chat_id, 5)
    await _send_step(
        update.message.reply_text, context, 6, "🕯️", "Vafot etgan sana",
        "Vafot etgan bo'lsa <b>sanasini</b> kiriting:\n<i>Format: KK.OO.YYYY</i>\n\n<i>(Tirik bo'lsa o'tkazib yuboring)</i>",
        _kb_skip(),
    )
    return S_DEATH_DATE


# ── 6. Vafot etgan sana ─────────────────────────────────────────
async def got_death_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text == CANCEL_TEXT: return await _do_cancel(update, context)
    if text != SKIP_TEXT:
        d = _parse_date(text)
        if not d:
            await update.message.reply_text("⚠️ Format noto'g'ri. KK.OO.YYYY shaklida kiriting:")
            return S_DEATH_DATE
        bd = _d(context).get('birth_date_iso')
        if bd and d.isoformat() <= bd:
            await update.message.reply_text("⚠️ Vafot sanasi tug'ilgan sanadan keyin bo'lishi kerak.")
            return S_DEATH_DATE
        _d(context)['death_date']     = d.strftime('%d.%m.%Y')
        _d(context)['death_date_iso'] = d.isoformat()
    chat_id = update.effective_chat.id
    await _delete_user_msg(update)
    await _delete_step_msg(context, chat_id, 6)
    await _send_step(
        update.message.reply_text, context, 7, "🔢", "Farzand raqami",
        "<b>Oilada nechanchi farzand</b> ekanligini kiriting:\n<i>Masalan: 3</i>\n\n"
        "⚠️ <b>Majburiy maydon</b> — tug'ilgan sanasi noma'lum bo'lsa\n"
        "farzand raqamiga qarab tartiblanadi.",
        _kb_cancel(),
    )
    return S_CHILD_NUMBER


# ── 7. Farzand raqami (MAJBURIY) ────────────────────────────────
async def got_child_number(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text == CANCEL_TEXT: return await _do_cancel(update, context)
    if not text.isdigit() or not (1 <= int(text) <= 50):
        await update.message.reply_text(
            "⚠️ 1 dan 50 gacha raqam kiriting <b>(majburiy)</b>:",
            parse_mode='HTML',
        )
        return S_CHILD_NUMBER
    _d(context)['child_number'] = int(text)
    chat_id = update.effective_chat.id
    await _delete_user_msg(update)
    await _delete_step_msg(context, chat_id, 7)
    await _send_step(
        update.message.reply_text, context, 8, "📍", "Tug'ilgan joyi",
        "<b>Tug'ilgan joyini</b> kiriting:\n<i>Masalan: Samarqand viloyati, Urgut tumani</i>\n\n<i>(Ixtiyoriy)</i>",
        _kb_skip(),
    )
    return S_BIRTH_PLACE


# ── 8. Tug'ilgan joyi ───────────────────────────────────────────
async def got_birth_place(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text == CANCEL_TEXT: return await _do_cancel(update, context)
    if text != SKIP_TEXT:
        _d(context)['birth_place'] = text[:200]
    chat_id = update.effective_chat.id
    await _delete_user_msg(update)
    await _delete_step_msg(context, chat_id, 8)
    await _send_step(
        update.message.reply_text, context, 9, "📞", "Telefon",
        "<b>Telefon raqamini</b> kiriting:\n<i>Masalan: +998901234567</i>\n\n<i>(Ixtiyoriy)</i>",
        _kb_skip(),
    )
    return S_PHONE


# ── 9. Telefon ──────────────────────────────────────────────────
async def got_phone(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if text == CANCEL_TEXT: return await _do_cancel(update, context)
    if text != SKIP_TEXT:
        _d(context)['phone'] = text[:20]
    chat_id = update.effective_chat.id
    await _delete_user_msg(update)
    await _delete_step_msg(context, chat_id, 9)

    kb  = await _parent_kb('male', "Otasi ma'lum emas")
    msg = await update.message.reply_text(
        f"👨  <b>Otasi</b>   {'🟩'*10}{'⬜'*3} <b>10/{TOTAL}</b>\n"
        "━━━━━━━━━━━━━━━\n\n"
        "Shaxsning <b>otasini</b> ro'yxatdan tanlang:\n<i>(Ma'lum bo'lmasa o'tkazib yuboring)</i>",
        parse_mode='HTML',
        reply_markup=ReplyKeyboardRemove(),
    )
    context.user_data['qmsg_10'] = msg.message_id
    await update.message.reply_text("👨 Erkaklar ro'yxati 👇", reply_markup=kb)
    return S_FATHER


# ── 10. Otasi (inline) ──────────────────────────────────────────
async def got_father(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query   = update.callback_query
    await query.answer()
    chat_id = query.message.chat_id

    if query.data != 'psel_skip':
        pid = int(query.data.split('_')[1])
        from apps.persons.models import Person
        try:
            p = await Person.objects.aget(id=pid)
            _d(context)['father_id']   = p.id
            _d(context)['father_name'] = p.full_name
        except Person.DoesNotExist:
            pass

    # Inline list xabarini o'chirish
    try: await query.message.delete()
    except Exception: pass
    await _delete_step_msg(context, chat_id, 10)

    opp = 'female' if _d(context).get('gender') == 'male' else 'male'
    kb  = await _parent_kb(opp, "Onasi ma'lum emas")
    logger.info(f"[add_person] got_father -> S_MOTHER, chat_id={chat_id}")
    try:
        msg = await context.bot.send_message(
            chat_id=chat_id,
            text=(
                f"{'👩' if opp=='female' else '👨'}  <b>Onasi</b>   {'🟩'*11}{'⬜'*2} <b>11/{TOTAL}</b>\n"
                "━━━━━━━━━━━━━━━\n\n"
                "Shaxsning <b>onasini</b> ro'yxatdan tanlang:\n<i>(Ma'lum bo'lmasa o'tkazib yuboring)</i>"
            ),
            parse_mode='HTML',
        )
        context.user_data['qmsg_11'] = msg.message_id
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"{'👩' if opp=='female' else '👨'} Ro'yxat 👇",
            reply_markup=kb,
        )
    except Exception as e:
        logger.error(f"[add_person] got_father xabar yuborishda xato: {e}", exc_info=True)
    return S_MOTHER


# ── 11. Onasi (inline) ──────────────────────────────────────────
async def got_mother(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query   = update.callback_query
    await query.answer()
    chat_id = query.message.chat_id
    logger.info(f"[add_person] got_mother chaqirildi, chat_id={chat_id}, data={query.data}")

    if query.data != 'psel_skip':
        pid = int(query.data.split('_')[1])
        from apps.persons.models import Person
        try:
            p = await Person.objects.aget(id=pid)
            _d(context)['mother_id']   = p.id
            _d(context)['mother_name'] = p.full_name
        except Person.DoesNotExist:
            pass

    try: await query.message.delete()
    except Exception: pass
    await _delete_step_msg(context, chat_id, 11)

    opp = 'female' if _d(context).get('gender') == 'male' else 'male'
    kb  = await _spouse_kb(opp)
    try:
        msg = await context.bot.send_message(
            chat_id=chat_id,
            text=(
                f"💍  <b>Turmush o'rtog'i</b>   {'🟩'*12}{'⬜'*1} <b>12/{TOTAL}</b>\n"
                "━━━━━━━━━━━━━━━\n\n"
                "Turmush o'rtog'ini tanlang:\n<i>(Bo'lmasa o'tkazib yuboring)</i>"
            ),
            parse_mode='HTML',
        )
        context.user_data['qmsg_12'] = msg.message_id
        await context.bot.send_message(
            chat_id=chat_id,
            text=f"{'👩' if opp=='female' else '👨'} Ro'yxat 👇",
            reply_markup=kb,
        )
    except Exception as e:
        logger.error(f"[add_person] got_mother xabar yuborishda xato: {e}", exc_info=True)
    return S_SPOUSE


# ── 12. Turmush o'rtog'i (inline) ───────────────────────────────
async def got_spouse(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query   = update.callback_query
    await query.answer()
    chat_id = query.message.chat_id
    logger.info(f"[add_person] got_spouse chaqirildi, chat_id={chat_id}, data={query.data}")

    if query.data != 'psel_skip':
        pid = int(query.data.split('_')[1])
        from apps.persons.models import Person
        try:
            p = await Person.objects.aget(id=pid)
            _d(context)['spouse_id']   = p.id
            _d(context)['spouse_name'] = p.full_name
        except Person.DoesNotExist:
            pass

    try: await query.message.delete()
    except Exception: pass
    await _delete_step_msg(context, chat_id, 12)

    try:
        msg = await context.bot.send_message(
            chat_id=chat_id,
            text=(
                f"📸  <b>Rasm</b>   {'🟩'*13} <b>13/{TOTAL}</b>\n"
                "━━━━━━━━━━━━━━━\n\n"
                "Shaxsning <b>rasmini</b> yuboring:\n\n"
                "<i>(Ixtiyoriy — o'tkazib yuborish mumkin)</i>"
            ),
            parse_mode='HTML',
            reply_markup=_kb_skip(),
        )
        context.user_data['qmsg_13'] = msg.message_id
    except Exception as e:
        logger.error(f"[add_person] got_spouse xabar yuborishda xato: {e}", exc_info=True)
    return S_PHOTO


# ── 13. Rasm ────────────────────────────────────────────────────
async def got_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text and update.message.text.strip() == CANCEL_TEXT:
        return await _do_cancel(update, context)

    if update.message.photo:
        photo = update.message.photo[-1]
        context.user_data['np_photo_file_id'] = photo.file_id
        _d(context)['has_photo'] = True

    chat_id = update.effective_chat.id
    await _delete_user_msg(update)
    await _delete_step_msg(context, chat_id, 13)

    # Intro xabarini ham o'chirish
    intro_id = context.user_data.pop('intro_msg_id', None)
    if intro_id:
        try: await context.bot.delete_message(chat_id=chat_id, message_id=intro_id)
        except Exception: pass

    loading = await update.message.reply_text(
        "⏳ Preview tayyorlanmoqda...",
        reply_markup=ReplyKeyboardRemove(),
    )
    try: await loading.delete()
    except Exception: pass

    return await _show_preview(
        context, chat_id,
        update.message.reply_photo,
        update.message.reply_text,
    )


# ── S_CONFIRM ───────────────────────────────────────────────────
async def confirm_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query   = update.callback_query
    await query.answer()
    tg_user = await _get_tg_user(query.from_user.id)
    chat_id = query.message.chat_id

    if query.data == 'addp_back':
        # Preview xabarini o'chirib rasm bosqichiga qaytish
        try: await query.message.delete()
        except Exception: pass
        context.user_data['np_photo_file_id'] = None
        _d(context).pop('has_photo', None)

        msg = await query.message.reply_text(
            f"📸  <b>Rasm</b>   <code>{'▓'*13} 13/{TOTAL}</code>\n"
            "━━━━━━━━━━━━━━━\n\n"
            "Rasmni qayta yuboring yoki o'tkazib yuboring:",
            parse_mode='HTML',
            reply_markup=_kb_skip(),
        )
        context.user_data['qmsg_13'] = msg.message_id
        return S_PHOTO

    # ── Preview xabarini o'chirish ──────────────────────────────
    try: await query.message.delete()
    except Exception: pass

    # ── Adminga yuborish ────────────────────────────────────────
    d       = _d(context)
    caption = _build_caption(d)

    req_key = f"pp_{tg_user.telegram_id}_{int(time.time())}"
    context.bot_data.setdefault('pending_persons', {})[req_key] = {
        'submitter_tg_id': tg_user.telegram_id,
        'submitter_name':  tg_user.full_name,
        'data':            d,
        'photo_file_id':   context.user_data.get('np_photo_file_id'),
    }

    admin_header  = (
        f"📬 <b>Yangi Shaxs So'rovi</b>\n"
        f"━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 Yuboruvchi: <b>{tg_user.full_name}</b>\n\n"
    )
    admin_caption = admin_header + caption
    admin_kb      = InlineKeyboardMarkup([[
        InlineKeyboardButton("✅ Tasdiqlash", callback_data=f"addp_approve_{req_key}"),
        InlineKeyboardButton("❌ Rad etish",  callback_data=f"addp_reject_{req_key}"),
    ]])

    from apps.bot.models import TelegramUser as TU
    sent = 0
    async for admin in TU.objects.select_related('user').filter(status='approved'):
        if not _is_admin(admin):
            continue
        try:
            pid = context.user_data.get('np_photo_file_id')
            if pid:
                await context.bot.send_photo(
                    chat_id=admin.telegram_id, photo=pid,
                    caption=admin_caption, parse_mode='HTML', reply_markup=admin_kb,
                )
            else:
                await context.bot.send_message(
                    chat_id=admin.telegram_id, text=admin_caption,
                    parse_mode='HTML', reply_markup=admin_kb,
                )
            sent += 1
        except Exception as e:
            logger.warning(f"Admin {admin.telegram_id}: {e}")

    full = f"{d.get('last_name','')} {d.get('first_name','')}".strip()
    await query.message.reply_text(
        f"📤 <b>So'rovingiz {sent} ta adminga yuborildi!</b>\n\n"
        f"<b>{full}</b> haqidagi ma'lumot ko'rib chiqilmoqda.\n"
        f"⏳ Admin javob berganda xabar olasiz 🔔",
        parse_mode='HTML',
    )

    context.user_data.pop('np', None)
    context.user_data.pop('np_photo_file_id', None)
    context.user_data.pop('preview_msg_id', None)
    kb = admin_menu_keyboard() if (tg_user and _is_admin(tg_user)) else main_menu_keyboard()
    await query.message.reply_text("🏠 Asosiy menyu:", reply_markup=kb)
    return ConversationHandler.END


# ══════════════════════════════════════════════════════════════════
#  ADMIN: TASDIQLASH / RAD ETISH
# ══════════════════════════════════════════════════════════════════

async def addp_approve_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query    = update.callback_query
    await query.answer()
    admin_tg = await _get_tg_user(query.from_user.id)
    if not admin_tg or not _is_admin(admin_tg):
        await query.answer("🚫 Admin huquqi yo'q.", show_alert=True)
        return

    req_key = '_'.join(query.data.split('_')[2:])
    req     = context.bot_data.get('pending_persons', {}).pop(req_key, None)
    if not req:
        await _safe_edit(query, "⚠️ Bu so'rov allaqachon ko'rib chiqilgan.")
        return

    d = req['data']
    from apps.persons.models import Person
    from django.utils.dateparse import parse_date

    try:
        kwargs = {
            'first_name':  d.get('first_name', ''),
            'last_name':   d.get('last_name', ''),
            'middle_name': d.get('middle_name', ''),
            'gender':      d.get('gender', 'male'),
            'birth_place': d.get('birth_place', ''),
            'phone':       d.get('phone', ''),
            'created_by':  admin_tg.user,
        }
        if d.get('birth_date_iso'):  kwargs['birth_date']   = parse_date(d['birth_date_iso'])
        if d.get('death_date_iso'):  kwargs['death_date']   = parse_date(d['death_date_iso'])
        if d.get('child_number'):    kwargs['child_number'] = d['child_number']
        if d.get('father_id'):       kwargs['father_id']    = d['father_id']
        if d.get('mother_id'):       kwargs['mother_id']    = d['mother_id']

        person = await Person.objects.acreate(**kwargs)

        if d.get('spouse_id'):
            from apps.persons.models import Family
            if d.get('gender') == 'male':
                await Family.objects.acreate(husband=person, wife_id=d['spouse_id'])
            else:
                await Family.objects.acreate(husband_id=d['spouse_id'], wife=person)

        photo_id = req.get('photo_file_id')
        if photo_id:
            try:
                from apps.bot.photo_utils import save_person_photo
                await save_person_photo(context.bot, photo_id, person)
            except Exception as e:
                logger.warning(f"Rasm saqlash: {e}")

        full = person.full_name
        await _safe_edit(query, f"✅ <b>{full}</b> shajara tizimiga qo'shildi!\n👑 {admin_tg.full_name}")
        try:
            await context.bot.send_message(
                chat_id=req['submitter_tg_id'],
                text=(
                    f"🎉 <b>Tabriklaymiz!</b>\n\n"
                    f"<b>{full}</b> haqidagi ma'lumot\n"
                    f"admin tomonidan tasdiqlandi va\n"
                    f"shajara tizimiga qo'shildi! 🌳"
                ),
                parse_mode='HTML',
            )
        except Exception as e:
            logger.warning(e)

    except Exception as e:
        logger.error(f"Shaxs saqlash: {e}")
        logger.error(f"addp_approve xato: {e}", exc_info=True)
        await _safe_edit(query, "❌ Xatolik yuz berdi. Qayta urinib ko'ring.")


async def addp_reject_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query    = update.callback_query
    await query.answer()
    admin_tg = await _get_tg_user(query.from_user.id)
    if not admin_tg or not _is_admin(admin_tg):
        await query.answer("🚫 Admin huquqi yo'q.", show_alert=True)
        return

    req_key = '_'.join(query.data.split('_')[2:])
    req     = context.bot_data.get('pending_persons', {}).pop(req_key, None)
    if not req:
        await _safe_edit(query, "⚠️ Bu so'rov allaqachon ko'rib chiqilgan.")
        return

    d    = req['data']
    full = f"{d.get('last_name','')} {d.get('first_name','')}".strip()
    await _safe_edit(query, f"❌ <b>{full}</b> so'rovi rad etildi.\n👑 {admin_tg.full_name}")
    try:
        await context.bot.send_message(
            chat_id=req['submitter_tg_id'],
            text=(
                f"😔 <b>So'rovingiz rad etildi</b>\n\n"
                f"<b>{full}</b> haqidagi ma'lumot\n"
                f"admin tomonidan qabul qilinmadi.\n\n"
                f"<i>Savol bo'lsa admin bilan bog'laning.</i>"
            ),
            parse_mode='HTML',
        )
    except Exception as e:
        logger.warning(e)


async def _safe_edit(query, text: str):
    try:
        if query.message.photo:
            await query.edit_message_caption(text, parse_mode='HTML')
        else:
            await query.edit_message_text(text, parse_mode='HTML')
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════════
#  BEKOR QILISH
# ══════════════════════════════════════════════════════════════════

async def _do_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    await _delete_all_steps(context, chat_id)
    intro_id = context.user_data.pop('intro_msg_id', None)
    if intro_id:
        try: await context.bot.delete_message(chat_id=chat_id, message_id=intro_id)
        except Exception: pass
    context.user_data.pop('np', None)
    context.user_data.pop('np_photo_file_id', None)
    tg_user = await _get_tg_user(update.effective_user.id)
    kb = admin_menu_keyboard() if (tg_user and _is_admin(tg_user)) else main_menu_keyboard()
    await update.message.reply_text(
        "❌ <b>Bekor qilindi.</b>", parse_mode='HTML', reply_markup=kb,
    )
    return ConversationHandler.END

async def cancel_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    return await _do_cancel(update, context)


# ══════════════════════════════════════════════════════════════════
#  CONVERSATION HANDLER
# ══════════════════════════════════════════════════════════════════

def get_add_person_conversation():
    txt = filters.TEXT & ~filters.COMMAND
    return ConversationHandler(
        entry_points=[
            MessageHandler(filters.Regex(r"^➕ Shaxs qo'shish$"), add_person_start),
        ],
        states={
            S_LAST_NAME:    [MessageHandler(txt, got_last_name)],
            S_FIRST_NAME:   [MessageHandler(txt, got_first_name)],
            S_MIDDLE_NAME:  [MessageHandler(txt, got_middle_name)],
            S_GENDER:       [MessageHandler(txt, got_gender)],
            S_BIRTH_DATE:   [MessageHandler(txt, got_birth_date)],
            S_DEATH_DATE:   [MessageHandler(txt, got_death_date)],
            S_CHILD_NUMBER: [MessageHandler(txt, got_child_number)],
            S_BIRTH_PLACE:  [MessageHandler(txt, got_birth_place)],
            S_PHONE:        [MessageHandler(txt, got_phone)],
            S_FATHER:  [CallbackQueryHandler(got_father, pattern=r'^psel_')],
            S_MOTHER:  [CallbackQueryHandler(got_mother, pattern=r'^psel_')],
            S_SPOUSE:  [CallbackQueryHandler(got_spouse, pattern=r'^psel_')],
            S_PHOTO: [
                MessageHandler(filters.PHOTO, got_photo),
                MessageHandler(txt, got_photo),
            ],
            S_CONFIRM: [
                CallbackQueryHandler(confirm_callback, pattern=r'^addp_(submit|back)$'),
            ],
        },
        fallbacks=[
            CommandHandler('cancel', cancel_cmd),
            MessageHandler(filters.Regex(f'^{CANCEL_TEXT}$'), cancel_cmd),
        ],
        per_chat=True,
        per_message=False,
        name='add_person',
        allow_reentry=True,
    )
