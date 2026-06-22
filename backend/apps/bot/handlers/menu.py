"""
Asosiy menyu handlerlari — refactored.
Umumiy utilitalar: handlers/utils.py
"""
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes

from apps.bot.handlers.start import _get_tg_user, _is_admin
from apps.bot.keyboards import (
    main_menu_keyboard, admin_menu_keyboard,
    persons_list_keyboard, confirm_delete_keyboard,
)
from apps.bot.handlers.utils import (
    check_approved as _check_approved,
    fmt_date as _fmt_date,
    age_str as _age_str,
    smart_edit as _smart_edit,
    person_card as _person_card,
    detail_kb as _detail_kb,
    edit_field_kb as _edit_field_kb,
    load_persons as _load_persons,
    persons_filter_kb as _persons_filter_kb,
    EDIT_FIELDS, PAGE_SZ, EDIT_FIELD,
)

logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════
#  SHAXSLAR RO'YXATI
# ══════════════════════════════════════════════════════════════════


def _persons_header(total: int, page: int, pages: int, active_filter: dict) -> str:
    parts = []
    if active_filter.get('search'):
        parts.append(f"🔍 «{active_filter['search']}»")
    if active_filter.get('gender') == 'male':
        parts.append("👨 Erkaklar")
    elif active_filter.get('gender') == 'female':
        parts.append("👩 Ayollar")
    if active_filter.get('alive') == 'yes':
        parts.append("🟢 Tiriklar")
    elif active_filter.get('alive') == 'no':
        parts.append("🌿 Vafot etganlar")
    if active_filter.get('birth_year'):
        parts.append(f"📅 {active_filter['birth_year']}-yil")
    filter_line = "  |  ".join(parts) if parts else "Barchasi"
    return (
        f"👨‍👩‍👧‍👦 <b>Shajara a'zolari</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"Filter: {filter_line}\n"
        f"Jami: <b>{total}</b> kishi  •  Sahifa: <b>{page+1}/{pages}</b>\n\n"
        f"Batafsil ma'lumot uchun ismni bosing 👇"
    )


async def _persons_list_msg(update_or_query, context, page: int = 0, *, is_callback=False):
    """Shaxslar ro'yxatini (filter bilan) yuboradi yoki tahrirlaydi."""
    af = context.user_data.get('persons_filter', {})
    persons = await _load_persons(
        search=af.get('search', ''),
        gender=af.get('gender', ''),
        alive=af.get('alive', ''),
        birth_year=af.get('birth_year', ''),
    )
    context.user_data['persons_cache'] = persons
    total  = len(persons)
    pages  = max((total + PAGE_SZ - 1) // PAGE_SZ, 1)
    page   = min(page, pages - 1)
    kb     = persons_list_keyboard(persons, page=page, page_size=PAGE_SZ)
    text   = _persons_header(total, page, pages, af)
    if is_callback:
        await _smart_edit(update_or_query, text, reply_markup=kb)
    else:
        await update_or_query.message.reply_text(text, parse_mode='HTML', reply_markup=kb)


async def handle_persons(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = await _check_approved(update)
    if not tg_user:
        return
    context.user_data.setdefault('persons_filter', {})
    from apps.bot.anim import Anim, frames_persons
    async with Anim(update, frames_persons()) as anim:
        af = context.user_data.get('persons_filter', {})
        persons = await _load_persons(
            search=af.get('search', ''),
            gender=af.get('gender', ''),
            alive=af.get('alive', ''),
            birth_year=af.get('birth_year', ''),
        )
        context.user_data['persons_cache'] = persons
        if not persons:
            await anim.done("📭 Natija topilmadi. Filterni tozalab ko'ring.")
            return
        await anim.delete()
    total = len(persons)
    pages = max((total + PAGE_SZ - 1) // PAGE_SZ, 1)
    kb    = persons_list_keyboard(persons, page=0, page_size=PAGE_SZ)
    text  = _persons_header(total, 0, pages, af)
    await update.message.reply_text(
        text, parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup(
            [*kb.inline_keyboard[:-1],
             [InlineKeyboardButton("🔍 Filtr", callback_data='pf_open')],
             kb.inline_keyboard[-1]]
        ),
    )


async def persons_page_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query   = update.callback_query
    await query.answer()
    page    = int(query.data.split('_')[-1])
    await _persons_list_msg(query, context, page=page, is_callback=True)


# ──── Filter callbacklar ───────────────────────────────────────────────────────

async def persons_filter_open_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Filter menyusini ko'rsatish."""
    query = update.callback_query
    await query.answer()
    af = context.user_data.get('persons_filter', {})
    await _smart_edit(query,
        "🔍 <b>Filtr</b>\n\nQaysi mezon bo'yicha filtrlashni xohlaysiz?",
        reply_markup=_persons_filter_kb(af),
    )


async def persons_filter_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """pf_gender / pf_alive / pf_year / pf_search / pf_reset."""
    query  = update.callback_query
    await query.answer()
    action = query.data  # e.g. 'pf_gender', 'pf_reset'
    af     = context.user_data.setdefault('persons_filter', {})

    if action == 'pf_reset':
        context.user_data['persons_filter'] = {}
        await _persons_list_msg(query, context, is_callback=True)
        return

    if action == 'pf_gender':
        cur = af.get('gender', '')
        if cur == '':    af['gender'] = 'male'
        elif cur == 'male':  af['gender'] = 'female'
        else:            af.pop('gender', None)
        await _persons_list_msg(query, context, is_callback=True)
        return

    if action == 'pf_alive':
        cur = af.get('alive', '')
        if cur == '':    af['alive'] = 'yes'
        elif cur == 'yes':   af['alive'] = 'no'
        else:            af.pop('alive', None)
        await _persons_list_msg(query, context, is_callback=True)
        return

    if action == 'pf_year':
        context.user_data['awaiting_filter_year'] = True
        await _smart_edit(query,
            "📅 <b>Tug'ilgan yil</b>\n\nYilni kiriting (masalan: <code>1955</code>):\n"
            "<i>O'tkazib yuborish uchun /cancel yozing</i>",
        )
        return

    if action == 'pf_search':
        context.user_data['awaiting_filter_search'] = True
        await _smart_edit(query,
            "🔍 <b>Qidirish</b>\n\nIsm, familiya yoki tug'ilgan joy kiriting:\n"
            "<i>O'tkazib yuborish uchun /cancel yozing</i>",
        )
        return


# ══════════════════════════════════════════════════════════════════
#  SHAXS TAFSILOTI
# ══════════════════════════════════════════════════════════════════

async def person_detail_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query     = update.callback_query
    await query.answer()
    person_id = int(query.data.split('_')[1])
    tg_user   = await _get_tg_user(query.from_user.id)
    if not tg_user or not tg_user.is_approved:
        return

    from apps.persons.models import Person
    try:
        p = await Person.objects.select_related('father', 'mother', 'created_by').aget(id=person_id)
    except Person.DoesNotExist:
        await _smart_edit(query, "❌ Shaxs topilmadi.")
        return

    context.user_data['detail_person_id'] = person_id

    can_edit = _is_admin(tg_user) or (
        tg_user.user_id and (
            (p.created_by_id and p.created_by_id == tg_user.user_id) or
            (p.linked_user_id and p.linked_user_id == tg_user.user_id)
        )
    )
    text = _person_card(p)
    kb   = _detail_kb(person_id, can_edit)

    if p.photo:
        try:
            import os
            from django.conf import settings as djs
            photo_path = os.path.join(djs.MEDIA_ROOT, str(p.photo))
            if os.path.exists(photo_path):
                # Oldingi xabarni o'chirish
                try: await query.message.delete()
                except Exception: pass
                with open(photo_path, 'rb') as f:
                    await query.message.reply_photo(
                        photo=f, caption=text,
                        parse_mode='HTML', reply_markup=kb,
                    )
                return
        except Exception as e:
            logger.warning(f"Rasm yuborishda xato: {e}")

    await _smart_edit(query, text, reply_markup=kb)


# ══════════════════════════════════════════════════════════════════
#  SHAXS TAHRIRLASH
# ══════════════════════════════════════════════════════════════════

async def edit_select_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Qaysi maydonni tahrirlashni tanlash."""
    query     = update.callback_query
    await query.answer()
    person_id = int(query.data.split('_')[2])
    tg_user   = await _get_tg_user(query.from_user.id)
    if not tg_user or not tg_user.is_approved:
        return

    kb = _edit_field_kb(person_id)
    await _smart_edit(
        query,
        f"✏️ <b>Tahrirlash</b>\n\nQaysi ma'lumotni o'zgartirmoqchisiz?",
        reply_markup=kb,
    )


async def edit_field_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Tanlangan maydonni tahrirlashga kirish."""
    query     = update.callback_query
    await query.answer()
    parts     = query.data.split('_')   # edit_field_{id}_{field}
    person_id = int(parts[2])
    field     = '_'.join(parts[3:])
    tg_user   = await _get_tg_user(query.from_user.id)
    if not tg_user or not tg_user.is_approved:
        return

    # Field label topish
    label = next((l for f, l, _ in EDIT_FIELDS if f == field), field)

    context.user_data['editing'] = {'person_id': person_id, 'field': field, 'label': label}

    # Rasm uchun alohida oqim
    if field == 'photo':
        cancel_kb = InlineKeyboardMarkup([[
            InlineKeyboardButton("🗑️ Rasmni o'chirish", callback_data=f"edit_photo_del_{person_id}"),
            InlineKeyboardButton("❌ Bekor", callback_data=f"edit_cancel_{person_id}"),
        ]])
        await _smart_edit(
            query,
            "🖼️ <b>Rasm yangilash</b>\n\n"
            "Yangi rasmni yuboring (fotosurat sifatida).\n\n"
            "<i>Rasmni o'chirish uchun — pastdagi tugmani bosing.</i>",
            reply_markup=cancel_kb,
        )
        context.user_data['awaiting_photo'] = True
        return

    hints = {
        'birth_date':   'Format: KK.OO.YYYY  (Masalan: 15.03.1975)',
        'death_date':   'Format: KK.OO.YYYY  (Bo\'sh qoldirish uchun: -)',
        'child_number': 'Faqat raqam (Masalan: 3)',
        'phone':        'Masalan: +998901234567',
    }
    hint = hints.get(field, '')

    cancel_kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("❌ Bekor", callback_data=f"edit_cancel_{person_id}")
    ]])
    await _smart_edit(
        query,
        f"✏️ <b>{label}</b>\n\n"
        f"Yangi qiymatni yozing:\n"
        f"<i>{hint}</i>",
        reply_markup=cancel_kb,
    )
    context.user_data['awaiting_edit_text'] = True
    return EDIT_FIELD


async def edit_field_text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Foydalanuvchi yangi qiymat yubordi."""
    if not context.user_data.get('awaiting_edit_text'):
        return
    context.user_data.pop('awaiting_edit_text', None)

    editing   = context.user_data.pop('editing', None)
    if not editing:
        return

    tg_user   = await _get_tg_user(update.effective_user.id)
    person_id = editing['person_id']
    field     = editing['field']
    label     = editing['label']
    raw       = update.message.text.strip()

    from apps.persons.models import Person
    try:
        p = await Person.objects.aget(id=person_id)
    except Person.DoesNotExist:
        await update.message.reply_text("❌ Shaxs topilmadi.")
        return

    # Validatsiya va o'zgartirish
    from datetime import datetime
    error = None

    if field in ('birth_date', 'death_date'):
        if raw == '-':
            setattr(p, field, None)
        else:
            parsed = None
            for fmt in ('%d.%m.%Y', '%d/%m/%Y', '%Y-%m-%d'):
                try:
                    parsed = datetime.strptime(raw, fmt).date()
                    break
                except ValueError:
                    pass
            if not parsed:
                error = "⚠️ Format noto'g'ri. KK.OO.YYYY shaklida kiriting (yoki <b>-</b> bo'sh qoldirish uchun)."
            else:
                setattr(p, field, parsed)
    elif field == 'child_number':
        if not raw.isdigit() or not (1 <= int(raw) <= 50):
            error = "⚠️ 1 dan 50 gacha raqam kiriting."
        else:
            p.child_number = int(raw)
    elif field == 'phone':
        p.phone = raw[:20]
    else:
        if len(raw) < 2 or len(raw) > 100:
            error = "⚠️ 2–100 ta belgi bo'lishi kerak."
        else:
            setattr(p, field, raw)

    if error:
        kb = InlineKeyboardMarkup([[
            InlineKeyboardButton("◀️ Orqaga", callback_data=f"edit_select_{person_id}")
        ]])
        await update.message.reply_text(error, parse_mode='HTML', reply_markup=kb)
        return

    await p.asave()
    context.user_data.pop('persons_cache', None)

    await update.message.reply_text(
        f"✅ <b>{label}</b> muvaffaqiyatli yangilandi!",
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("👤 Shaxsga qaytish", callback_data=f"person_{person_id}"),
            InlineKeyboardButton("✏️ Yana tahrirlash", callback_data=f"edit_select_{person_id}"),
        ]]),
    )


async def edit_photo_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Foydalanuvchi yangi rasm yubordi — shaxs rasmini yangilaydi."""
    if not context.user_data.get('awaiting_photo'):
        return False

    editing = context.user_data.get('editing', {})
    person_id = editing.get('person_id')
    if not person_id:
        return False

    context.user_data.pop('awaiting_photo', None)
    context.user_data.pop('editing', None)

    photo = update.message.photo[-1]  # eng katta o'lcham

    from apps.persons.models import Person
    import os, uuid
    from django.conf import settings as django_settings

    try:
        p = await Person.objects.aget(id=person_id)
    except Person.DoesNotExist:
        await update.message.reply_text("❌ Shaxs topilmadi.")
        return True

    # Eski rasmni o'chirish
    if p.photo:
        old_path = p.photo.path if hasattr(p.photo, 'path') else None
        if old_path and os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass

    # Rasmni yuklab olish
    tg_file = await context.bot.get_file(photo.file_id)
    ext = 'jpg'
    filename = f"{uuid.uuid4().hex}.{ext}"
    upload_dir = os.path.join(django_settings.MEDIA_ROOT, 'persons')
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, filename)
    await tg_file.download_to_drive(file_path)

    # Pillow bilan siqish va resize
    try:
        from PIL import Image as PilImage
        with PilImage.open(file_path) as img:
            img = img.convert('RGB')
            img.thumbnail((800, 800), PilImage.LANCZOS)
            img.save(file_path, 'JPEG', quality=85, optimize=True)
    except Exception as ex:
        logger.warning(f"Rasm siqishda xato: {ex}")

    # Modelga saqlash
    from django.core.files import File
    with open(file_path, 'rb') as f:
        await p.photo.asave(filename, File(f), save=False)
    await p.asave(update_fields=['photo'])

    # ImageKit CDN ga yuklash
    try:
        import asyncio as _asyncio
        from apps.persons.views import _upload_to_imagekit
        loop = _asyncio.get_event_loop()
        await loop.run_in_executor(None, _upload_to_imagekit, p)
        logger.info(f"[Bot] edit_photo: person {p.id} ImageKit ga yuklandi")
    except Exception as ik_err:
        logger.warning(f"[Bot] edit_photo ImageKit xato: {ik_err}")

    context.user_data.pop('persons_cache', None)

    await update.message.reply_text(
        "✅ <b>Rasm muvaffaqiyatli yangilandi!</b>",
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("👤 Shaxsga qaytish", callback_data=f"person_{person_id}"),
            InlineKeyboardButton("✏️ Yana tahrirlash", callback_data=f"edit_select_{person_id}"),
        ]]),
    )
    return True


async def edit_photo_delete_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Shaxs rasmini o'chirish."""
    query = update.callback_query
    await query.answer()
    person_id = int(query.data.split('_')[3])

    context.user_data.pop('awaiting_photo', None)
    context.user_data.pop('editing', None)

    from apps.persons.models import Person
    import os
    try:
        p = await Person.objects.aget(id=person_id)
    except Person.DoesNotExist:
        await query.answer("❌ Shaxs topilmadi.", show_alert=True)
        return

    if p.photo:
        old_path = p.photo.path if hasattr(p.photo, 'path') else None
        p.photo = None
        await p.asave(update_fields=['photo'])
        if old_path and os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass

    context.user_data.pop('persons_cache', None)
    await _smart_edit(
        query,
        "🗑️ <b>Rasm o'chirildi.</b>",
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("👤 Shaxsga qaytish", callback_data=f"person_{person_id}"),
        ]]),
    )


async def edit_cancel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query     = update.callback_query
    await query.answer()
    person_id = int(query.data.split('_')[-1])
    context.user_data.pop('editing', None)
    context.user_data.pop('awaiting_edit_text', None)
    context.user_data.pop('awaiting_photo', None)

    from apps.persons.models import Person
    try:
        p = await Person.objects.select_related('father', 'mother', 'created_by').aget(id=person_id)
    except Person.DoesNotExist:
        await _smart_edit(query, "❌ Shaxs topilmadi.")
        return

    tg_user  = await _get_tg_user(query.from_user.id)
    can_edit = _is_admin(tg_user) or (
        tg_user and tg_user.user_id and (
            (p.created_by_id and p.created_by_id == tg_user.user_id) or
            (p.linked_user_id and p.linked_user_id == tg_user.user_id)
        )
    )
    await _smart_edit(query, _person_card(p), reply_markup=_detail_kb(person_id, can_edit))


# ══════════════════════════════════════════════════════════════════
#  O'CHIRISH
# ══════════════════════════════════════════════════════════════════

async def delete_person_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query     = update.callback_query
    await query.answer()
    person_id = int(query.data.split('_')[1])

    from apps.persons.models import Person
    try:
        p = await Person.objects.aget(id=person_id)
    except Person.DoesNotExist:
        await _smart_edit(query, "❌ Shaxs topilmadi.")
        return

    kb = confirm_delete_keyboard(person_id)
    await _smart_edit(
        query,
        f"⚠️ <b>Diqqat!</b>\n\n"
        f"<b>{p.full_name}</b> ni shajara tizimidan o'chirmoqchimisiz?\n\n"
        f"<i>Bu amalni qaytarib bo'lmaydi.</i>",
        reply_markup=kb,
    )


async def confirm_delete_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query     = update.callback_query
    await query.answer()
    person_id = int(query.data.split('_')[-1])
    tg_user   = await _get_tg_user(query.from_user.id)
    if not tg_user or not tg_user.is_approved:
        return

    from apps.persons.models import Person
    try:
        p = await Person.objects.select_related('created_by').aget(id=person_id)
    except Person.DoesNotExist:
        await _smart_edit(query, "❌ Shaxs topilmadi.")
        return

    can_delete = _is_admin(tg_user) or (
        tg_user.user_id and (
            (p.created_by_id and p.created_by_id == tg_user.user_id) or
            (p.linked_user_id and p.linked_user_id == tg_user.user_id)
        )
    )
    if not can_delete:
        await _smart_edit(query, "🚫 Sizda bu shaxsni o'chirish huquqi yo'q.")
        return

    name = p.full_name
    await p.adelete()
    context.user_data.pop('persons_cache', None)
    await _smart_edit(query, f"🗑️ <b>{name}</b> shajara tizimidan o'chirildi.")


# ══════════════════════════════════════════════════════════════════
#  ORQAGA TUGMALARI
# ══════════════════════════════════════════════════════════════════

async def back_main_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query   = update.callback_query
    await query.answer()
    tg_user = await _get_tg_user(query.from_user.id)
    kb = admin_menu_keyboard() if (tg_user and _is_admin(tg_user)) else main_menu_keyboard()
    await _smart_edit(
        query,
        "🏠 <b>Asosiy menyu</b>",
        reply_markup=kb,
    )


async def back_persons_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query   = update.callback_query
    await query.answer()
    persons = context.user_data.get('persons_cache') or await _load_persons()
    context.user_data['persons_cache'] = persons
    total = len(persons)
    pages = (total + PAGE_SZ - 1) // PAGE_SZ
    kb    = persons_list_keyboard(persons, page=0, page_size=PAGE_SZ)
    text  = (
        f"👨‍👩‍👧‍👦 <b>Shajara a'zolari</b>\n"
        f"━━━━━━━━━━━━━━━\n"
        f"Jami: <b>{total}</b> kishi  •  Sahifa: <b>1/{pages}</b>\n\n"
        f"Batafsil ma'lumot uchun ismni bosing 👇"
    )
    await _smart_edit(query, text, reply_markup=kb)


# ══════════════════════════════════════════════════════════════════
#  MENYU HANDLERLARI
# ══════════════════════════════════════════════════════════════════

def _bar(count: int, total: int, length: int = 12) -> str:
    """Emoji progress bar."""
    if total == 0:
        return "░" * length
    filled = round(count / total * length)
    return "█" * filled + "░" * (length - filled)

def _pct(count: int, total: int) -> str:
    if total == 0:
        return "0%"
    return f"{count/total*100:.1f}%"


async def handle_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = await _check_approved(update)
    if not tg_user:
        return

    from apps.bot.anim import Anim, frames_stats
    from apps.persons.models import Person
    from django.utils import timezone
    from django.db import connection
    import asyncio, io
    from telegram import InputFile
    from datetime import date as _date

    anim = Anim(update, frames_stats(), interval=0.55)
    await anim.__aenter__()

    try:
        today = timezone.now().date()

        # ── Barcha ma'lumotlarni VALUES orqali bir queryset bilan ──────
        # id, gender, birth_date, death_date, father_id, last_name, first_name, photo
        rows = []
        async for row in Person.objects.values_list(
            'id', 'gender', 'birth_date', 'death_date',
            'father_id', 'last_name', 'first_name', 'photo'
        ):
            rows.append(row)

        total    = len(rows)
        male     = sum(1 for r in rows if r[1] == 'male')
        female   = sum(1 for r in rows if r[1] == 'female')
        alive    = sum(1 for r in rows if r[3] is None)
        deceased = sum(1 for r in rows if r[3] is not None)
        with_photo = sum(1 for r in rows if r[7])

        # ── Oylar bo'yicha ───────────────────────────────────────────
        monthly = [0] * 12
        for r in rows:
            if r[2]:
                monthly[r[2].month - 1] += 1

        # ── Yosh hisoblash (birth_date dan) ──────────────────────────
        def _calc_age(birth: _date, death: _date | None) -> int | None:
            end = death or today
            if not birth:
                return None
            age = end.year - birth.year - ((end.month, end.day) < (birth.month, birth.day))
            return age if age >= 0 else None

        age_groups_raw = {'0–18': 0, '19–35': 0, '36–60': 0, '60+': 0}
        avg_sum = 0; avg_cnt = 0
        oldest = None; youngest = None; oldest_dec = None

        for r in rows:
            pid, gender, birth, death, father_id, lname, fname, photo = r
            full_name = f"{lname or ''} {fname or ''}".strip()
            age = _calc_age(birth, death)
            if age is None:
                continue
            if death is None:  # tirik
                avg_sum += age; avg_cnt += 1
                if oldest is None or age > oldest[0]:
                    oldest = (age, full_name)
                if youngest is None or age < youngest[0]:
                    youngest = (age, full_name)
                if age <= 18:   age_groups_raw['0–18'] += 1
                elif age <= 35: age_groups_raw['19–35'] += 1
                elif age <= 60: age_groups_raw['36–60'] += 1
                else:           age_groups_raw['60+'] += 1
            else:  # vafot etgan
                if oldest_dec is None or age > oldest_dec[0]:
                    oldest_dec = (age, full_name)

        avg_age = avg_sum / avg_cnt if avg_cnt else 0

        # ── Ko'p farzandli ───────────────────────────────────────────
        ch_counts: dict[int, int] = {}
        for r in rows:
            fid = r[4]  # father_id
            if fid:
                ch_counts[fid] = ch_counts.get(fid, 0) + 1
        # mother_id — alohida query
        async for mid in Person.objects.filter(mother_id__isnull=False).values_list('mother_id', flat=True):
            ch_counts[mid] = ch_counts.get(mid, 0) + 1

        most_ch = None
        if ch_counts:
            best_id = max(ch_counts, key=lambda x: ch_counts[x])
            best_row = next((r for r in rows if r[0] == best_id), None)
            if best_row:
                bname = f"{best_row[5] or ''} {best_row[6] or ''}".strip()
                most_ch = (ch_counts[best_id], bname)

        # ── Avlod chuqurligi (iterativ, sikldan himoyalangan) ─────────
        id_to_fid = {r[0]: r[4] for r in rows}
        gen_map: dict[int, int] = {}
        for pid in id_to_fid:
            depth = 1
            cur = pid
            visited = set()
            while True:
                fid = id_to_fid.get(cur)
                if not fid or fid not in id_to_fid or fid in visited:
                    break
                visited.add(cur)
                cur = fid
                depth += 1
            gen_map[depth] = gen_map.get(depth, 0) + 1

        gen_data = [(f"{g}-avlod", cnt) for g, cnt in sorted(gen_map.items())]
        age_group_list = list(age_groups_raw.items())

        # ── Rasmlarga render ─────────────────────────────────────────
        from apps.bot.stats_renderer import (
            render_overview, render_monthly, render_generations, render_records,
            AMBER, PURPLE, TEAL, ORANGE, RED, CYAN, BLUE, GREEN, PINK,
        )

        stats = {
            'total': total, 'male': male, 'female': female,
            'alive': alive, 'deceased': deceased, 'with_photo': with_photo,
            'avg_age_alive': avg_age,
            'oldest_name':  f"{oldest[1]} ({oldest[0]} y)"    if oldest    else '—',
            'youngest_name': f"{youngest[1]} ({youngest[0]} y)" if youngest else '—',
            'most_children_name': f"{most_ch[1]} ({most_ch[0]} ta)" if most_ch and most_ch[0] else '—',
        }

        records = [
            {'icon': '🎂', 'title': 'Eng katta (tirik)',  'name': oldest[1]    if oldest    else '—', 'value': f"{oldest[0]} yosh"    if oldest    else '—', 'color': AMBER},
            {'icon': '🍼', 'title': 'Eng yosh (tirik)',   'name': youngest[1]  if youngest  else '—', 'value': f"{youngest[0]} yosh"  if youngest  else '—', 'color': TEAL},
            {'icon': '🕯️', 'title': 'Eng katta (vafot)', 'name': oldest_dec[1] if oldest_dec else '—', 'value': f"{oldest_dec[0]} yosh" if oldest_dec else '—', 'color': PURPLE},
            {'icon': '👨‍👦', 'title': "Ko'p farzandli",    'name': most_ch[1]   if most_ch   else '—', 'value': f"{most_ch[0]} ta"    if most_ch   else '—', 'color': ORANGE},
            {'icon': '📸', 'title': 'Rasmi bor',          'name': f"{with_photo}/{total} a'zo", 'value': f"{with_photo/total*100:.0f}%" if total else '0%', 'color': CYAN},
            {'icon': '📅', 'title': "O'rtacha yosh",      'name': "Tirik a'zolar bo'yicha",     'value': f"{avg_age:.0f} yosh",                               'color': GREEN},
        ]

        loop = asyncio.get_event_loop()
        img1 = await loop.run_in_executor(None, render_overview,    stats)
        img2 = await loop.run_in_executor(None, render_monthly,     monthly)
        img3 = await loop.run_in_executor(None, render_generations, gen_data, age_group_list)
        img4 = await loop.run_in_executor(None, render_records,     records)

        await anim.__aexit__(None, None, None)

        await update.message.reply_photo(
            photo=InputFile(io.BytesIO(img1), filename='stats_umumiy.png'),
            caption="📊 <b>Umumiy ko'rsatkichlar</b>", parse_mode='HTML',
        )
        await update.message.reply_photo(
            photo=InputFile(io.BytesIO(img2), filename='stats_oylar.png'),
            caption="📅 <b>Oylar bo'yicha tug'ilganlar</b>", parse_mode='HTML',
        )
        await update.message.reply_photo(
            photo=InputFile(io.BytesIO(img3), filename='stats_avlodlar.png'),
            caption="🌳 <b>Avlodlar & yosh guruhlari</b>", parse_mode='HTML',
        )
        await update.message.reply_photo(
            photo=InputFile(io.BytesIO(img4), filename='stats_rekordlar.png'),
            caption="🏆 <b>Rekordlar & qiziqarli faktlar</b>", parse_mode='HTML',
        )

    except Exception as e:
        logger.error(f"handle_stats xato: {e}", exc_info=True)
        await anim.done("❌ Xatolik yuz berdi. Iltimos qayta urinib ko'ring.")


async def handle_dashboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = await _check_approved(update)
    if not tg_user or not _is_admin(tg_user):
        await update.message.reply_text("🚫 Bu funksiya faqat adminlar uchun.")
        return
    from apps.bot.anim import Anim, frames_stats
    from apps.persons.models import Person, Reminder
    from apps.bot.models import TelegramUser as TU
    from django.utils import timezone
    import datetime

    anim = Anim(update, frames_stats())
    await anim.__aenter__()
    try:
        today = timezone.now().date()
        week_ago  = today - datetime.timedelta(days=7)
        month_ago = today - datetime.timedelta(days=30)
        tomorrow  = today + datetime.timedelta(days=1)
        week_later = today + datetime.timedelta(days=7)

        # A'zolar
        rows = []
        async for row in Person.objects.values_list('gender', 'death_date', 'created_at', 'photo'):
            rows.append(row)

        total    = len(rows)
        male     = sum(1 for r in rows if r[0] == 'male')
        female   = total - male
        deceased = sum(1 for r in rows if r[1] is not None)
        alive    = total - deceased
        with_photo = sum(1 for r in rows if r[3])
        new_week  = sum(1 for r in rows if r[2] and r[2].date() >= week_ago)
        new_month = sum(1 for r in rows if r[2] and r[2].date() >= month_ago)

        # Tug'ilgan kunlar
        bday_today    = await Person.objects.filter(
            birth_date__month=today.month, birth_date__day=today.day,
            death_date__isnull=True).acount()
        bday_tomorrow = await Person.objects.filter(
            birth_date__month=tomorrow.month, birth_date__day=tomorrow.day,
            death_date__isnull=True).acount()

        # Yaqin 7 kunda tug'ilgan kunlar (yil mustaqil)
        bday_week = 0
        async for p in Person.objects.filter(
            birth_date__isnull=False, death_date__isnull=True
        ).only('birth_date'):
            du = _days_until(p.birth_date, today)
            if 1 <= du <= 7:
                bday_week += 1

        # Eslatmalar (Reminder)
        rem_today = 0
        async for r in Reminder.objects.filter(is_active=True).only('date'):
            if _days_until(r.date, today) == 0:
                rem_today += 1

        # Bot foydalanuvchilari
        pending  = await TU.objects.filter(status=TU.STATUS_PENDING).acount()
        approved = await TU.objects.filter(status=TU.STATUS_APPROVED).acount()
        rejected = await TU.objects.filter(status=TU.STATUS_REJECTED).acount()

        # So'nggi qo'shilgan shaxs
        last_name = ''
        async for p in Person.objects.order_by('-created_at').only(
            'last_name', 'first_name', 'middle_name', 'created_at'
        )[:1]:
            last_name = f"{p.full_name} ({p.created_at.strftime('%d.%m.%Y')})"

        male_pct   = round(male / total * 100) if total else 0
        female_pct = 100 - male_pct if total else 0
        alive_pct  = round(alive / total * 100) if total else 0
        photo_pct  = round(with_photo / total * 100) if total else 0

        alert = f"\n\n🔔 <b>{pending} ta yangi so'rov kutmoqda!</b>" if pending else ""

        text = (
            f"📊 <b>ADMIN DASHBOARD</b>\n"
            f"{'━' * 22}\n"
            f"🕐 {today.strftime('%d.%m.%Y')}\n\n"

            f"👥 <b>A'ZOLAR</b>\n"
            f"  ├ Jami:       <b>{total} kishi</b>\n"
            f"  ├ 👨 Erkak:   <b>{male}</b>  ({male_pct}%)\n"
            f"  ├ 👩 Ayol:    <b>{female}</b>  ({female_pct}%)\n"
            f"  ├ 💚 Tirik:   <b>{alive}</b>  ({alive_pct}%)\n"
            f"  ├ 🌿 Vafot:   <b>{deceased}</b>\n"
            f"  └ 📸 Rasmi:   <b>{with_photo}</b>  ({photo_pct}%)\n\n"

            f"📅 <b>FAOLLIK</b>\n"
            f"  ├ Hafta ichida qo'shildi:  <b>{new_week}</b>\n"
            f"  ├ Oy ichida qo'shildi:     <b>{new_month}</b>\n"
            f"  └ Oxirgi: <i>{last_name or '—'}</i>\n\n"

            f"🎂 <b>YAQIN SANALAR</b>\n"
            f"  ├ Bugun tug'ilgan kun:    <b>{bday_today}</b> kishi\n"
            f"  ├ Ertaga tug'ilgan kun:   <b>{bday_tomorrow}</b> kishi\n"
            f"  ├ 7 kunda tug'ilgan kun:  <b>{bday_week}</b> kishi\n"
            f"  └ Bugun eslatmalar:       <b>{rem_today}</b> ta\n\n"

            f"🤖 <b>BOT FOYDALANUVCHILARI</b>\n"
            f"  ├ ✅ Tasdiqlangan: <b>{approved}</b>\n"
            f"  ├ ⏳ Kutilmoqda:  <b>{pending}</b>\n"
            f"  └ 🚫 Rad etilgan: <b>{rejected}</b>"
            f"{alert}"
        )
        await anim.done(text)
    except Exception as e:
        logger.error(f"handle_dashboard xato: {e}", exc_info=True)
        await anim.done("❌ Xatolik yuz berdi. Qayta urinib ko'ring.")


async def handle_users(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = await _check_approved(update)
    if not tg_user or not _is_admin(tg_user):
        await update.message.reply_text("🚫 Bu funksiya faqat adminlar uchun.")
        return
    from apps.bot.anim import Anim, frames_persons
    from apps.bot.models import TelegramUser as TU
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup

    async with Anim(update, frames_persons()) as anim:
        users = []
        async for u in TU.objects.select_related('user').filter(
            status=TU.STATUS_APPROVED
        ).order_by('full_name'):
            users.append(u)
        pending_count = await TU.objects.filter(status=TU.STATUS_PENDING).acount()
        await anim.delete()

    pending_count = pending_count  # already set

    if not users:
        await update.message.reply_text(
            "👤 <b>Bot Foydalanuvchilari</b>\n━━━━━━━━━━━━━━━\n\nHali foydalanuvchi yo'q.",
            parse_mode='HTML',
        )
        return

    header = (
        "👥 <b>BOT FOYDALANUVCHILARI</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n"
        f"✅ Tasdiqlangan: <b>{len(users)}</b> ta"
        + (f"   •   ⏳ Kutilmoqda: <b>{pending_count}</b>" if pending_count else "")
    )
    await update.message.reply_text(header, parse_mode='HTML')

    for i, u in enumerate(users, 1):
        icon = "👑" if _is_admin(u) else "👤"
        role_text = "Admin" if _is_admin(u) else "A'zo"
        name_link = f'<a href="tg://user?id={u.telegram_id}">{u.full_name}</a>'
        username_part = f"  @{u.telegram_name}" if u.telegram_name else ""

        user_text = (
            f"{i}. {icon} {name_link}{username_part}\n"
            f"   <code>ID: {u.telegram_id}</code>  •  <i>{role_text}</i>"
        )
        kb = InlineKeyboardMarkup([[
            InlineKeyboardButton("📩 Xabar", callback_data=f"umsg_{u.telegram_id}"),
            InlineKeyboardButton("⚠️ Ogohlantirish", callback_data=f"uwarn_{u.telegram_id}"),
            InlineKeyboardButton("🚫 Bloklash", callback_data=f"ublock_{u.telegram_id}"),
        ]])
        await update.message.reply_text(user_text, parse_mode='HTML', reply_markup=kb)


async def handle_invite(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = await _check_approved(update)
    if not tg_user or not _is_admin(tg_user):
        await update.message.reply_text("🚫 Bu funksiya faqat adminlar uchun.")
        return
    from apps.bot.models import BotInvite
    from django.utils import timezone
    invite = await BotInvite.objects.acreate(
        created_by=tg_user,
        expires_at=timezone.now() + timezone.timedelta(days=7),
    )
    me   = await context.bot.get_me()
    link = f"https://t.me/{me.username}?start=INV_{invite.token}"
    await update.message.reply_text(
        f"🔗 <b>Yangi Invite Link</b>\n"
        f"━━━━━━━━━━━━━━━\n\n"
        f"<code>{link}</code>\n\n"
        f"⏳ Muddat: <b>7 kun</b>\n"
        f"🔂 Foydalanish: <b>1 marta</b>\n\n"
        f"<i>Bu linkni faqat ishonchli shaxsga yuboring.</i>",
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("📤 Ulashish", switch_inline_query=link)
        ]]),
    )


# ══════════════════════════════════════════════════════════════════
#  ESLATMALAR — to'liq tizim
# ══════════════════════════════════════════════════════════════════

def _rem_keyboard(time_f: str) -> InlineKeyboardMarkup:
    """Sodda vaqt filtri — faqat 4 ta tugma."""
    opts = [
        ('today', '📅 Bugun'),
        ('week',  '📆 7 kun'),
        ('month', '🗓 Bu oy'),
        ('all',   '📋 Hammasi'),
    ]
    row = [
        InlineKeyboardButton(
            ('✅ ' if time_f == k else '') + l,
            callback_data=f"remf_{k}"
        )
        for k, l in opts
    ]
    return InlineKeyboardMarkup([row])


from apps.persons.services import (
    days_until as _days_until,
    next_occurrence as _next_occurrence,
    collect_reminders as _collect_reminders_service,
)


async def _collect_reminders(time_f: str) -> list[dict]:
    """services.collect_reminders ga delegatsiya."""
    return await _collect_reminders_service(time_f)




def _format_reminders_text(items: list[dict], time_f: str) -> str:
    """Sodda, qulay ko'rinish — yoshi kattalar uchun ham tushunarli."""
    TIME_LABELS = {
        'today': 'Bugun',
        'week':  'Keyingi 7 kun',
        'month': 'Bu oy',
        'all':   'Barcha eslatmalar',
    }
    header = f"🔔 <b>ESLATMALAR — {TIME_LABELS.get(time_f, '')}</b>\n\n"

    if not items:
        tips = {
            'today': "Bugun hech kimning sana-tadbirisi yo'q.",
            'week':  "Keyingi 7 kunda eslatma yo'q.",
            'month': "Bu oyda eslatma yo'q.",
            'all':   "Hozircha eslatma qo'shilmagan.",
        }
        return header + f"😌 {tips.get(time_f, 'Eslatma topilmadi.')}"

    lines = [header]
    for i, item in enumerate(items, 1):
        du = item['days_until']
        g  = '👨' if item['gender'] == 'male' else '👩'

        if du == 0:
            when = "🔴 <b>BUGUN!</b>"
        elif du == 1:
            when = "🟡 Ertaga"
        elif du <= 7:
            when = f"🟢 {du} kundan keyin"
        else:
            when = f"⚪️ {item['date'].strftime('%d-%B').replace('January','yanvar').replace('February','fevral').replace('March','mart').replace('April','aprel').replace('May','may').replace('June','iyun').replace('July','iyul').replace('August','avgust').replace('September','sentabr').replace('October','oktabr').replace('November','noyabr').replace('December','dekabr')}"

        lines.append(
            f"{i}. {item['icon']} {g} <b>{item['person_name']}</b>\n"
            f"   {when}  •  <i>{item['note'] or item['label']}</i>"
        )

    lines.append(f"\n<i>Jami {len(items)} ta eslatma</i>")
    return "\n".join(lines)


async def handle_reminders(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = await _check_approved(update)
    if not tg_user:
        return

    from apps.bot.anim import Anim, frames_reminders

    async with Anim(update, frames_reminders()) as anim:
        items = await _collect_reminders('week')
        text  = _format_reminders_text(items, 'week')
        kb    = _rem_keyboard('week')
        # Shaxs tugmalari
        kb    = _add_person_buttons(kb, items, 'week')
        await anim.delete()

    await update.message.reply_text(text, parse_mode='HTML', reply_markup=kb)


def _add_person_buttons(kb: InlineKeyboardMarkup, items: list[dict],
                        time_f: str) -> InlineKeyboardMarkup:
    """Ro'yxatdagi shaxslar uchun tezkor tugmalar qo'shadi (max 8 ta)."""
    seen, btns = set(), []
    for item in items:
        pid = item['person_id']
        if pid in seen or len(btns) >= 8:
            continue
        seen.add(pid)
        words = item['person_name'].split()
        short = ' '.join(words[:2]) if len(words) > 1 else item['person_name']
        btns.append(InlineKeyboardButton(
            f"{'👨' if item['gender']=='male' else '👩'} {short}",
            callback_data=f"remp_{pid}_{time_f}"
        ))
    if not btns:
        return kb
    rows = [btns[i:i+2] for i in range(0, len(btns), 2)]
    return InlineKeyboardMarkup(list(kb.inline_keyboard) + rows)


async def reminders_filter_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    tg_user = await _check_approved(update)
    if not tg_user:
        return

    # callback_data: remf_{time_f}
    time_f = query.data.split('_')[1]

    items = await _collect_reminders(time_f)
    text  = _format_reminders_text(items, time_f)
    kb    = _add_person_buttons(_rem_keyboard(time_f), items, time_f)

    try:
        await query.edit_message_text(text, parse_mode='HTML', reply_markup=kb)
    except Exception:
        pass


async def reminders_person_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Shaxs tugmasi — uning barcha eslatmalarini ko'rsatadi."""
    query = update.callback_query
    await query.answer()

    tg_user = await _check_approved(update)
    if not tg_user:
        return

    # callback_data: remp_{person_id}_{time_f}
    parts     = query.data.split('_')
    person_id = int(parts[1])
    time_f    = parts[2]

    from apps.persons.models import Person, Reminder
    from django.utils import timezone

    today = timezone.now().date()

    try:
        p = await Person.objects.aget(id=person_id)
    except Person.DoesNotExist:
        await query.answer("Shaxs topilmadi", show_alert=True)
        return

    g = '👨' if p.gender == 'male' else '👩'
    lines = [f"{g} <b>{p.full_name}</b> — eslatmalar\n"]

    count = 0
    async for r in Reminder.objects.filter(
        person_id=person_id, is_active=True
    ).order_by('date'):
        count += 1
        du = _days_until(r.date, today)
        nd = _next_occurrence(r.date, today)

        if   du == 0: when = "🔴 Bugun!"
        elif du == 1: when = "🟡 Ertaga"
        elif du <= 7: when = f"🟢 {du} kun qoldi"
        elif du <= 30:when = f"⚪️ {du} kun qoldi"
        else:         when = f"📅 {nd.strftime('%d.%m.%Y')}"

        extra = ''
        if r.type == 'birthday':
            age = today.year - r.date.year + (
                0 if (today.month, today.day) <= (r.date.month, r.date.day) else 1
            )
            extra = f" ({age} yosh)"

        note = f"\n   📝 {r.note}" if r.note else ''
        lines.append(
            f"{count}. {r.icon} <b>{r.get_type_display()}</b>{extra}\n"
            f"   {when}{note}"
        )

    if count == 0:
        lines.append("Bu shaxs uchun eslatma yo'q.")

    back_kb = InlineKeyboardMarkup([[
        InlineKeyboardButton("◀️ Ro'yxatga qaytish", callback_data=f"remf_{time_f}")
    ]])
    try:
        await query.edit_message_text("\n".join(lines), parse_mode='HTML', reply_markup=back_kb)
    except Exception:
        pass


def _build_text_tree(persons) -> str:
    """Matnli shajara daraxti — ierarxik ro'yxat."""
    pmap = {p.id: p for p in persons}
    all_ids = set(pmap)

    # Bolalar xaritasi (ota bo'yicha)
    children_of = {pid: [] for pid in all_ids}
    for p in pmap.values():
        if p.father_id and p.father_id in all_ids:
            children_of[p.father_id].append(p.id)
        elif p.mother_id and p.mother_id in all_ids and (
                not p.father_id or p.father_id not in all_ids):
            children_of[p.mother_id].append(p.id)
    for pid in children_of:
        children_of[pid].sort(key=lambda c: (
            pmap[c].child_number or 99,
            pmap[c].birth_date or __import__('datetime').date(2100,1,1)
        ))

    # Xotin xaritasi
    spouse_map = {}
    for p in pmap.values():
        f, m = p.father_id, p.mother_id
        if f and m and f in all_ids and m in all_ids:
            spouse_map.setdefault(f, m)
            spouse_map.setdefault(m, f)

    spouse_only = set()
    for pid, spid in spouse_map.items():
        if not children_of.get(pid) and children_of.get(spid):
            spouse_only.add(pid)

    has_parent = set()
    for p in pmap.values():
        if p.father_id and p.father_id in all_ids:
            has_parent.add(p.id)
        if p.mother_id and p.mother_id in all_ids:
            has_parent.add(p.id)

    roots = sorted(
        [pid for pid in all_ids if pid not in has_parent and pid not in spouse_only],
        key=lambda pid: pmap[pid].child_number or 99
    )

    lines = []
    visited = set()

    def person_str(p):
        icon = '👨' if p.gender == 'male' else '👩'
        dead = '🕯️' if p.death_date else ''
        years = ''
        if p.birth_date:
            years = str(p.birth_date.year)
            if p.death_date:
                years += f'–{p.death_date.year}'
            else:
                age = p.age
                if age:
                    years += f' ({age} y)'
        return f"{dead}{icon} <b>{p.full_name}</b>" + (f"  <i>{years}</i>" if years else "")

    def walk(pid, depth, prefix='', is_last=True):
        if pid in visited:
            return
        visited.add(pid)
        p = pmap[pid]

        if depth == 0:
            lines.append(person_str(p))
            # Spouse
            sp = spouse_map.get(pid)
            if sp and sp in pmap and sp in spouse_only:
                visited.add(sp)
                lines.append(f"  ♥ {person_str(pmap[sp])}")
        else:
            connector = '└─' if is_last else '├─'
            lines.append(f"{prefix}{connector} {person_str(p)}")
            sp = spouse_map.get(pid)
            if sp and sp in pmap and sp in spouse_only:
                visited.add(sp)
                sp_prefix = prefix + ('   ' if is_last else '│  ')
                lines.append(f"{sp_prefix}♥ {person_str(pmap[sp])}")

        children = [c for c in children_of.get(pid, []) if c not in spouse_only]
        child_prefix = prefix + ('   ' if (is_last or depth == 0) else '│  ')
        for i, cid in enumerate(children):
            walk(cid, depth + 1, child_prefix, i == len(children) - 1)

    for i, r in enumerate(roots):
        walk(r, 0, '', i == len(roots) - 1)
        if i < len(roots) - 1:
            lines.append('')

    return '\n'.join(lines)


async def handle_tree(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Shajara daraxtini rasm + matn sifatida yuboradi."""
    tg_user = await _check_approved(update)
    if not tg_user:
        return

    from apps.bot.anim import Anim, frames_tree
    from apps.persons.models import Person
    from apps.bot.tree_renderer import render_tree
    import asyncio, io
    from telegram import InputFile

    async with Anim(update, frames_tree(), interval=0.7) as anim:
        try:
            persons = []
            async for p in Person.objects.select_related('father', 'mother').all():
                persons.append(p)

            if not persons:
                await anim.done("❌ Bazada hali shaxslar yo'q.")
                return

            loop = asyncio.get_event_loop()
            img_bytes = await loop.run_in_executor(None, render_tree, persons)
            await anim.delete()

        except Exception as e:
            logger.error(f"Tree render xato: {e}", exc_info=True)
            await anim.done("❌ Xatolik yuz berdi. Iltimos qayta urinib ko'ring.")
            return

    # 1. Rasm
    await update.message.reply_photo(
        photo=InputFile(io.BytesIO(img_bytes), filename='shajara_daraxti.png'),
        caption=(
            "🌳 <b>Matayev & Abdumannonovlar Shajarasi</b>\n"
            f"👨‍👩‍👧‍👦 Jami: <b>{len(persons)}</b> shaxs"
        ),
        parse_mode='HTML',
    )

    # 2. Matnli shajara
    tree_text = _build_text_tree(persons)
    header = (
        "🌳 <b>SHAJARA — MATN KO'RINISHI</b>\n"
        "━━━━━━━━━━━━━━━━━━━━━━\n\n"
    )
    full = header + tree_text
    chunk_size = 3800
    chunks = [full[i:i+chunk_size] for i in range(0, len(full), chunk_size)]
    for chunk in chunks:
        await update.message.reply_text(chunk, parse_mode='HTML')


async def handle_my_profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Foydalanuvchining o'z profili — linked_user orqali topiladi."""
    tg_user = await _check_approved(update)
    if not tg_user:
        return
    if not tg_user.user_id:
        await update.message.reply_text(
            "👤 <b>Mening profilim</b>\n\n"
            "Sizning akkauntingiz hali shajara shaxsiga bog'lanmagan.\n"
            "Admin bilan bog'laning yoki veb saytda ro'yxatdan o'ting.",
            parse_mode='HTML',
        )
        return

    from apps.persons.models import Person
    try:
        p = await Person.objects.select_related('father', 'mother').aget(
            linked_user_id=tg_user.user_id
        )
    except Person.DoesNotExist:
        await update.message.reply_text(
            "👤 <b>Mening profilim</b>\n\n"
            "Sizning akkauntingizga bog'langan shaxs topilmadi.\n"
            "Admin bilan bog'laning.",
            parse_mode='HTML',
        )
        return

    text = _person_card(p)
    kb   = _detail_kb(p.id, can_edit=True)
    if p.photo:
        try:
            import os
            from django.conf import settings as djs
            photo_path = os.path.join(djs.MEDIA_ROOT, str(p.photo))
            if os.path.exists(photo_path):
                with open(photo_path, 'rb') as f:
                    await update.message.reply_photo(
                        photo=f, caption=text,
                        parse_mode='HTML', reply_markup=kb,
                    )
                return
        except Exception as e:
            logger.warning(f"Profil rasmi xato: {e}")
    await update.message.reply_text(text, parse_mode='HTML', reply_markup=kb)


async def handle_web(update: Update, context: ContextTypes.DEFAULT_TYPE):
    tg_user = await _check_approved(update)
    if not tg_user:
        return
    from django.conf import settings
    url = getattr(settings, 'WEB_BASE_URL', 'https://shajara.uz')
    await update.message.reply_text(
        "🌐 <b>Shajara Veb Sayti</b>\n\n"
        "Shajara daraxtini to'liq ko'rish va boshqarish uchun veb saytga o'ting.",
        parse_mode='HTML',
        reply_markup=InlineKeyboardMarkup([[
            InlineKeyboardButton("🌐 Veb saytga o'tish", url=url)
        ]]),
    )


# ─── Foydalanuvchi amallar (admin) ────────────────────────────────────────────

async def user_msg_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Foydalanuvchiga xabar yuborish — admindan matn kutish."""
    query = update.callback_query
    await query.answer()
    admin = await _get_tg_user(query.from_user.id)
    if not admin or not _is_admin(admin):
        return
    target_id = int(query.data.split('_', 1)[1])
    context.user_data['send_msg_to'] = target_id
    await query.message.reply_text(
        f"✏️ <b>Xabar yuborish</b>\n"
        f"Foydalanuvchi ID: <code>{target_id}</code>\n\n"
        f"Yuboriladigan matnni yozing:\n"
        f"<i>(Bekor qilish: /cancel)</i>",
        parse_mode='HTML',
    )


async def user_warn_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Foydalanuvchiga ogohlantirish yuborish."""
    query = update.callback_query
    await query.answer()
    admin = await _get_tg_user(query.from_user.id)
    if not admin or not _is_admin(admin):
        return
    target_id = int(query.data.split('_', 1)[1])
    from apps.bot.models import TelegramUser as TU
    try:
        target = await TU.objects.aget(telegram_id=target_id)
    except TU.DoesNotExist:
        await query.answer("Foydalanuvchi topilmadi.", show_alert=True)
        return

    warn_text = (
        "⚠️ <b>Ogohlantirish!</b>\n\n"
        "Admin sizga ogohlantirish yubordi.\n"
        "Iltimos, bot qoidalariga rioya qiling."
    )
    try:
        await context.bot.send_message(chat_id=target_id, text=warn_text, parse_mode='HTML')
        await query.answer(f"✅ {target.full_name} ga ogohlantirish yuborildi.", show_alert=True)
        await query.message.reply_text(
            f"⚠️ <b>{target.full_name}</b> ga ogohlantirish yuborildi.",
            parse_mode='HTML',
        )
    except Exception as e:
        logger.error(f"user_warn_callback xato: {e}", exc_info=True)
        await query.answer("Xatolik yuz berdi.", show_alert=True)


async def user_block_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Foydalanuvchini bloklash (rad etilgan holat)."""
    query = update.callback_query
    await query.answer()
    admin = await _get_tg_user(query.from_user.id)
    if not admin or not _is_admin(admin):
        return
    target_id = int(query.data.split('_', 1)[1])
    from apps.bot.models import TelegramUser as TU
    try:
        target = await TU.objects.aget(telegram_id=target_id)
    except TU.DoesNotExist:
        await query.answer("Foydalanuvchi topilmadi.", show_alert=True)
        return

    if admin.telegram_id == target_id:
        await query.answer("O'zingizni bloklayolmaysiz!", show_alert=True)
        return

    target.status = TU.STATUS_REJECTED
    await target.asave()

    try:
        await context.bot.send_message(
            chat_id=target_id,
            text="🚫 Sizning bot huquqingiz admin tomonidan bloklandi.",
        )
    except Exception:
        pass

    await query.edit_message_reply_markup(reply_markup=None)
    await query.message.reply_text(
        f"🚫 <b>{target.full_name}</b> bloklandi.",
        parse_mode='HTML',
    )


async def user_send_msg_text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin yozgan matnni maqsadli foydalanuvchiga yuboradi."""
    target_id = context.user_data.pop('send_msg_to', None)
    if not target_id:
        return False
    text = update.message.text.strip()
    admin = await _get_tg_user(update.effective_user.id)
    try:
        await context.bot.send_message(
            chat_id=target_id,
            text=f"📩 <b>Admin xabari:</b>\n\n{text}",
            parse_mode='HTML',
        )
        await update.message.reply_text("✅ Xabar yuborildi.", parse_mode='HTML')
    except Exception as e:
        logger.error(f"user_send_msg xato: {e}", exc_info=True)
        await update.message.reply_text("❌ Xabar yuborishda xatolik yuz berdi.")
    return True
