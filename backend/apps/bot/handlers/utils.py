"""
Bot uchun umumiy yordamchi funksiyalar va konstantalar.
"""
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup

from apps.bot.handlers.start import _get_tg_user, _is_admin
from apps.bot.keyboards import (
    main_menu_keyboard, admin_menu_keyboard,
    persons_list_keyboard, confirm_delete_keyboard,
)

logger  = logging.getLogger(__name__)
PAGE_SZ = 8

EDIT_FIELD = 50

EDIT_FIELDS = [
    ("photo",        "Rasm",               "🖼️"),
    ("last_name",    "Familiya",           "🏷️"),
    ("first_name",   "Ism",                "✨"),
    ("middle_name",  "Otasining ismi",     "👨"),
    ("gender",       "Jins",               "⚧"),
    ("birth_date",   "Tug'ilgan sana",     "🎂"),
    ("deceased",     "Vafot etgan holat",  "🕯️"),
    ("death_date",   "Vafot etgan sana",   "🌿"),
    ("child_number", "Farzand raqami",     "🔢"),
    ("birth_place",  "Tug'ilgan joyi",     "📍"),
    ("phone",        "Telefon",            "📞"),
    ("father",       "Otasi",              "👨‍👦"),
    ("mother",       "Onasi",              "👩‍👦"),
    ("note",         "Izoh / Bio",         "📝"),
]


async def check_approved(update: Update):
    tg_id   = update.effective_user.id
    tg_user = await _get_tg_user(tg_id)
    if not tg_user or not tg_user.is_approved:
        msg = update.message or (update.callback_query and update.callback_query.message)
        if msg:
            await msg.reply_text("🔒 Kirish cheklangan.\nAdmin sizga invite link yuborishi kerak.")
        return None
    return tg_user


def fmt_date(d) -> str:
    return d.strftime('%d.%m.%Y') if d else ''


def age_str(p) -> str:
    if not p.birth_date:
        return ''
    age = p.age
    if not age:
        return ''
    if p.death_date:
        would_be = p.age_would_be
        base = f'{age} yil yashagan'
        if would_be:
            base += f'  •  <i>{would_be} yosh bo\'lar edi</i>'
        return base
    return f'{age} yosh'


async def smart_edit(query, text, parse_mode='HTML', reply_markup=None):
    try:
        if query.message.photo:
            chat_id = query.message.chat_id
            try:
                await query.message.delete()
            except Exception:
                pass
            return await query.get_bot().send_message(
                chat_id=chat_id, text=text,
                parse_mode=parse_mode, reply_markup=reply_markup,
            )
        else:
            return await query.edit_message_text(
                text, parse_mode=parse_mode, reply_markup=reply_markup,
            )
    except Exception as e:
        logger.warning(f"smart_edit xato: {e}")


def person_card(p) -> str:
    g_icon = "👨" if p.gender == 'male' else "👩"
    gender = "Erkak" if p.gender == 'male' else "Ayol"
    s_icon = "🟢" if not p.death_date else "🌿"
    status = "Tirik" if not p.death_date else "Vafot etgan"

    def row(icon, label, value):
        return f"{icon} <b>{label}:</b>  {value}"

    rows = [
        f"{g_icon} <b>{p.full_name}</b>",
        "─────────────────────",
        row("⚧", "Jins",    f"{g_icon} {gender}"),
        row(s_icon, "Holat", status),
    ]
    if p.birth_date:
        age  = age_str(p)
        val  = f"<b>{fmt_date(p.birth_date)}</b>"
        if age:
            val += f"  <i>({age})</i>"
        rows.append(row("🎂", "Tug'ilgan", val))
    if p.death_date:
        rows.append(row("🕯️", "Vafot",    f"<b>{fmt_date(p.death_date)}</b>"))
    if p.birth_place:
        rows.append(row("📍", "Joyi",      p.birth_place))
    if p.child_number:
        rows.append(row("🔢", "Farzand",  f"<b>{p.child_number}-chi</b>"))
    if p.phone:
        rows.append(row("📞", "Tel",       f"<code>{p.phone}</code>"))

    rows.append("─────────────────────")
    rows.append("<b>👨‍👩‍👧‍👦 Oila aloqalari:</b>")
    if p.father:
        rows.append(f"  👨 <b>Otasi:</b>   {p.father.full_name}")
    if p.mother:
        rows.append(f"  👩 <b>Onasi:</b>   {p.mother.full_name}")

    return "\n".join(rows)


def detail_kb(person_id: int, can_edit: bool) -> InlineKeyboardMarkup:
    rows = []
    if can_edit:
        rows.append([
            InlineKeyboardButton("✏️ Tahrirlash", callback_data=f"edit_select_{person_id}"),
            InlineKeyboardButton("🗑️ O'chirish",  callback_data=f"delete_{person_id}"),
        ])
    rows.append([InlineKeyboardButton("◀️ Ro'yxatga", callback_data="back_persons")])
    return InlineKeyboardMarkup(rows)


def edit_field_kb(person_id: int) -> InlineKeyboardMarkup:
    rows = []
    for i in range(0, len(EDIT_FIELDS), 2):
        row = []
        for field, label, icon in EDIT_FIELDS[i:i+2]:
            row.append(InlineKeyboardButton(
                f"{icon} {label}", callback_data=f"edit_field_{person_id}_{field}"
            ))
        rows.append(row)
    rows.append([InlineKeyboardButton("◀️ Orqaga", callback_data=f"person_{person_id}")])
    return InlineKeyboardMarkup(rows)


async def load_persons(
    search: str = '',
    gender: str = '',
    alive: str = '',
    birth_year: str = '',
    birth_place: str = '',
):
    from apps.persons.models import Person
    qs = Person.objects.all()
    if search:
        from django.db.models import Q
        qs = qs.filter(
            Q(last_name__icontains=search) |
            Q(first_name__icontains=search) |
            Q(middle_name__icontains=search) |
            Q(birth_place__icontains=search)
        )
    if gender in ('male', 'female'):
        qs = qs.filter(gender=gender)
    if alive == 'yes':
        qs = qs.filter(death_date__isnull=True)
    elif alive == 'no':
        qs = qs.filter(death_date__isnull=False)
    if birth_year:
        try:
            qs = qs.filter(birth_date__year=int(birth_year))
        except (ValueError, TypeError):
            pass
    if birth_place:
        qs = qs.filter(birth_place__icontains=birth_place)

    persons = []
    async for p in qs.order_by('last_name', 'first_name', 'middle_name'):
        persons.append({
            'id':          p.id,
            'full_name':   p.full_name,
            'gender':      p.gender,
            'birth_date':  fmt_date(p.birth_date),
            'birth_year':  p.birth_date.year if p.birth_date else None,
            'birth_place': p.birth_place or '',
            'is_alive':    p.death_date is None,
        })
    return persons


def persons_filter_kb(active: dict | None = None) -> InlineKeyboardMarkup:
    """Shaxslar ro'yxati uchun filter tugmalari."""
    a = active or {}
    gender_icon = {'male': '👨', 'female': '👩'}.get(a.get('gender', ''), '⚧')
    alive_icon  = {'yes': '🟢', 'no': '🌿'}.get(a.get('alive', ''), '👥')
    rows = [
        [
            InlineKeyboardButton(f"{gender_icon} Jins", callback_data='pf_gender'),
            InlineKeyboardButton(f"{alive_icon} Holat", callback_data='pf_alive'),
            InlineKeyboardButton("📅 Yil", callback_data='pf_year'),
        ],
        [
            InlineKeyboardButton("🔍 Ism/joy qidirish", callback_data='pf_search'),
        ],
    ]
    if any(a.get(k) for k in ('gender', 'alive', 'birth_year', 'search')):
        rows.append([InlineKeyboardButton("🔄 Filterni tozalash", callback_data='pf_reset')])
    return InlineKeyboardMarkup(rows)
