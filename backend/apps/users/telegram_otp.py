"""Telegram bot orqali OTP yuborish."""
import requests
from decouple import config

BOT_TOKEN = config('TELEGRAM_BOT_TOKEN', default='')
BASE_URL  = f'https://api.telegram.org/bot{BOT_TOKEN}'


def _normalize(phone: str) -> str:
    return ''.join(c for c in phone if c.isdigit())


def _variants(phone: str) -> set:
    """Telefon raqamning barcha mumkin bo'lgan formatlarini qaytaradi."""
    clean = _normalize(phone)
    result = {clean}
    if clean.startswith('998') and len(clean) == 12:
        result.add(clean[3:])           # 998901234567 → 901234567
    if clean.startswith('0') and len(clean) == 10:
        result.add('998' + clean[1:])   # 0901234567 → 998901234567
    if len(clean) == 9:
        result.add('998' + clean)       # 901234567 → 998901234567
    return result


def _phone_matches(phone_from_msg: str, variants: set) -> bool:
    clean = _normalize(phone_from_msg)
    if not clean:
        return False
    return any(v == clean or clean.endswith(v[-9:]) for v in variants if len(v) >= 9)


def _lookup_chat_id_from_db(phone: str) -> str | None:
    """Bazadan saqlangan chat_id ni qaytaradi."""
    from .models import TelegramChat
    try:
        return TelegramChat.objects.get(phone=_normalize(phone)).chat_id
    except TelegramChat.DoesNotExist:
        return None


def _save_chat_id(phone: str, chat_id: str) -> None:
    """chat_id ni bazaga saqlaydi yoki yangilaydi."""
    from .models import TelegramChat
    TelegramChat.objects.update_or_create(
        phone=_normalize(phone),
        defaults={'chat_id': chat_id},
    )


def _poll_chat_id(phone: str) -> str | None:
    """
    getUpdates orqali chat_id topadi va bazaga saqlaydi.
    Foydalanuvchi avval botga xabar yuborganida ishlaydi.
    """
    if not BOT_TOKEN:
        return None

    variants = _variants(phone)

    try:
        r = requests.get(
            f'{BASE_URL}/getUpdates',
            params={'limit': 100, 'offset': -100},
            timeout=8,
        )
        r.raise_for_status()
        updates = r.json().get('result', [])

        for upd in reversed(updates):
            msg = upd.get('message', {})
            from_user = msg.get('from', {})
            chat_id = str(from_user.get('id', ''))
            if not chat_id:
                continue

            # 1) Matn sifatida yuborilgan telefon raqami
            text = msg.get('text', '') or ''
            if _phone_matches(text, variants):
                _save_chat_id(phone, chat_id)
                return chat_id

            # 2) Contact (Share Contact tugmasi)
            contact = msg.get('contact', {})
            if contact and _phone_matches(contact.get('phone_number', ''), variants):
                cid = str(contact.get('user_id') or chat_id)
                _save_chat_id(phone, cid)
                return cid

    except Exception as e:
        print(f'[Telegram] getUpdates xatosi: {e}')

    return None


def _get_chat_id(phone: str) -> str | None:
    """
    chat_id olish tartibi:
    1. Bazadan (tez, ishonchli)
    2. getUpdates polling (birinchi marta yoki eskirganda)
    """
    cached = _lookup_chat_id_from_db(phone)
    if cached:
        return cached
    return _poll_chat_id(phone)


def get_bot_link() -> str:
    if not BOT_TOKEN:
        return ''
    try:
        r = requests.get(f'{BASE_URL}/getMe', timeout=5)
        r.raise_for_status()
        username = r.json().get('result', {}).get('username', '')
        return f'https://t.me/{username}' if username else ''
    except Exception:
        return ''


def send_otp(phone: str, code: str) -> bool:
    """
    OTP ni Telegram orqali yuboradi.
    True  — yuborildi.
    False — yuborilmadi (dev_code frontend da ko'rinadi).
    """
    if not BOT_TOKEN:
        print(f'[DEV OTP] {phone} → {code}')
        return False

    chat_id = _get_chat_id(phone)
    if not chat_id:
        print(f'[Telegram] chat_id topilmadi: {phone}')
        return False

    text = (
        f'🔐 *Shajara — tasdiqlash kodi*\n\n'
        f'Sizning bir martalik kodingiz:\n\n'
        f'`{code}`\n\n'
        f'⏱ Kod *1 daqiqa* davomida amal qiladi\\.\n'
        f'Agar siz bu so\'rovni yubormagan bo\'lsangiz, e\'tibor bermang\\.'
    )
    try:
        r = requests.post(
            f'{BASE_URL}/sendMessage',
            json={'chat_id': chat_id, 'text': text, 'parse_mode': 'MarkdownV2'},
            timeout=8,
        )
        data = r.json()
        if data.get('ok'):
            return True

        # chat_id eskirgan bo'lishi mumkin — bazadan o'chir, qayta urinib ko'r
        error_code = data.get('error_code')
        if error_code in (400, 403):
            from .models import TelegramChat
            TelegramChat.objects.filter(phone=_normalize(phone)).delete()
            print(f'[Telegram] Eskirgan chat_id o\'chirildi: {phone}')

        print(f'[Telegram] sendMessage xatosi: {data}')
        return False
    except Exception as e:
        print(f'[Telegram] so\'rov xatosi: {e}')
        return False
