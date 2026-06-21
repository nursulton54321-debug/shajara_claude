"""Eskiz.uz orqali SMS yuborish."""
import requests
from decouple import config

ESKIZ_EMAIL    = config('ESKIZ_EMAIL', default='')
ESKIZ_PASSWORD = config('ESKIZ_PASSWORD', default='')
ESKIZ_BASE     = 'https://notify.eskiz.uz/api'
ESKIZ_FROM     = config('ESKIZ_FROM', default='4546')


def _normalize_phone(phone: str) -> str:
    digits = ''.join(c for c in phone if c.isdigit())
    if digits.startswith('998') and len(digits) == 12:
        return digits
    if digits.startswith('0') and len(digits) == 10:
        return '998' + digits[1:]
    if len(digits) == 9:
        return '998' + digits
    return digits


def _get_token() -> str | None:
    if not (ESKIZ_EMAIL and ESKIZ_PASSWORD):
        return None
    try:
        r = requests.post(
            f'{ESKIZ_BASE}/auth/login',
            data={'email': ESKIZ_EMAIL, 'password': ESKIZ_PASSWORD},
            timeout=8,
        )
        r.raise_for_status()
        return r.json().get('data', {}).get('token')
    except Exception as e:
        print(f'[Eskiz] login xatosi: {e}')
        return None


def send_sms(phone: str, code: str) -> bool:
    """Eskiz.uz orqali SMS yuboradi. True = muvaffaqiyatli."""
    if not (ESKIZ_EMAIL and ESKIZ_PASSWORD):
        return False

    token = _get_token()
    if not token:
        return False

    mobile  = _normalize_phone(phone)
    message = f'Shajara tasdiqlash kodi: {code}. Kod 1 daqiqa davomida amal qiladi.'

    try:
        r = requests.post(
            f'{ESKIZ_BASE}/message/sms/send',
            headers={'Authorization': f'Bearer {token}'},
            data={
                'mobile_phone': mobile,
                'message':      message,
                'from':         ESKIZ_FROM,
            },
            timeout=10,
        )
        data = r.json()
        if data.get('status') == 'waiting':
            return True
        print(f'[Eskiz] SMS xatosi: {data}')
        return False
    except Exception as e:
        print(f'[Eskiz] so\'rov xatosi: {e}')
        return False
