from telegram import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton

WEB_URL = "https://shajara.uz"  # settings dan olinadi keyin


def main_menu_keyboard():
    """Oddiy foydalanuvchi menyusi."""
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("👥 Shaxslar"),    KeyboardButton("🌳 Shajara daraxti")],
            [KeyboardButton("➕ Shaxs qo'shish"), KeyboardButton("📈 Statistika")],
            [KeyboardButton("🔔 Eslatmalar"),   KeyboardButton("👤 Mening profilim")],
            [KeyboardButton("🌐 Veb saytga o'tish")],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
    )


def admin_menu_keyboard():
    """Admin menyusi — qo'shimcha imkoniyatlar."""
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton("👥 Shaxslar"),      KeyboardButton("🌳 Shajara daraxti")],
            [KeyboardButton("➕ Shaxs qo'shish"), KeyboardButton("📊 Dashboard")],
            [KeyboardButton("📈 Statistika"),     KeyboardButton("🔔 Eslatmalar")],
            [KeyboardButton("👤 Foydalanuvchilar"), KeyboardButton("🔗 Invite link")],
            [KeyboardButton("🌐 Veb saytga o'tish")],
        ],
        resize_keyboard=True,
        one_time_keyboard=False,
    )


def persons_list_keyboard(persons, page=0, page_size=8):
    """Shaxslar ro'yxati — inline tugmalar (alifbo, tug'ilgan sana bilan)."""
    start = page * page_size
    chunk = persons[start:start + page_size]
    rows  = []
    for p in chunk:
        icon  = '👨' if p['gender'] == 'male' else '👩'
        label = f"{icon} {p['full_name']}"
        if p.get('birth_date'):
            label += f"  •  {p['birth_date']}"
        rows.append([InlineKeyboardButton(label, callback_data=f"person_{p['id']}")])

    total = len(persons)
    pages = (total + page_size - 1) // page_size

    # Navigatsiya qatori
    nav = []
    if page > 0:
        nav.append(InlineKeyboardButton(f"◀️  {page}", callback_data=f"persons_page_{page-1}"))
    if page + 1 < pages:
        nav.append(InlineKeyboardButton(f"{page+2}  ▶️", callback_data=f"persons_page_{page+1}"))
    if nav:
        rows.append(nav)

    rows.append([InlineKeyboardButton("🏠 Asosiy menyu", callback_data="back_main")])
    return InlineKeyboardMarkup(rows)


def person_detail_keyboard(person_id: int, can_edit: bool):
    """Shaxs kartochkasi tugmalari."""
    rows = []
    if can_edit:
        rows.append([
            InlineKeyboardButton("✏️ Tahrirlash", callback_data=f"edit_{person_id}"),
            InlineKeyboardButton("🗑️ O'chirish",  callback_data=f"delete_{person_id}"),
        ])
    rows.append([InlineKeyboardButton("◀️ Ro'yxatga qaytish", callback_data="back_persons")])
    return InlineKeyboardMarkup(rows)


def confirm_delete_keyboard(person_id: int):
    return InlineKeyboardMarkup([[
        InlineKeyboardButton("🗑️ Ha, o'chirish", callback_data=f"confirm_delete_{person_id}"),
        InlineKeyboardButton("↩️ Orqaga",        callback_data=f"person_{person_id}"),
    ]])


def cancel_keyboard():
    return ReplyKeyboardMarkup(
        [[KeyboardButton("❌ Bekor qilish")]],
        resize_keyboard=True, one_time_keyboard=True,
    )
