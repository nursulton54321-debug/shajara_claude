"""
Bot → ImageKit: Telegram faylini diskga saqlamay to'g'ridan-to'g'ri CDN ga yuklash.
"""
import io
import logging

logger = logging.getLogger(__name__)


async def upload_tg_photo_to_imagekit(bot, file_id: str, person_id: int) -> str:
    """
    Telegram file_id → xotirada resize → ImageKit CDN.
    Muvaffaqiyatli bo'lsa CDN URL qaytaradi, aks holda bo'sh string.
    """
    try:
        from PIL import Image as PilImage
        from django.conf import settings as djs

        pk     = getattr(djs, 'IMAGEKIT_PRIVATE_KEY', '')
        pub    = getattr(djs, 'IMAGEKIT_PUBLIC_KEY', '')
        url_ep = getattr(djs, 'IMAGEKIT_URL_ENDPOINT', '')
        if not (pk and pub and url_ep):
            logger.warning("[photo_utils] ImageKit sozlanmagan")
            return ''

        # 1) Telegram → xotira
        tg_file = await bot.get_file(file_id)
        buf_in = io.BytesIO()
        await tg_file.download_to_memory(buf_in)
        buf_in.seek(0)

        # 2) PIL → resize + compress
        with PilImage.open(buf_in) as img:
            img = img.convert('RGB')
            img.thumbnail((800, 800), PilImage.LANCZOS)
            buf_out = io.BytesIO()
            img.save(buf_out, 'JPEG', quality=85, optimize=True)
        img_bytes = buf_out.getvalue()

        # 3) ImageKit ga yuklash (sync requests → executor)
        import asyncio
        import requests as req_lib

        fname = f"person_{person_id}.jpg"

        def _do_upload():
            return req_lib.post(
                'https://upload.imagekit.io/api/v1/files/upload',
                auth=(pk, ''),
                files={'file': (fname, img_bytes, 'image/jpeg')},
                data={'fileName': fname, 'folder': '/shajara/photos/'},
                timeout=30,
            )

        loop = asyncio.get_event_loop()
        resp = await loop.run_in_executor(None, _do_upload)
        logger.info(f"[photo_utils] ImageKit status={resp.status_code}")
        if resp.status_code == 200:
            url = resp.json().get('url', '')
            if url:
                logger.info(f"[photo_utils] OK: {url}")
                return url

    except Exception as e:
        logger.warning(f"[photo_utils] upload xato: {e}", exc_info=True)

    return ''


async def save_person_photo(bot, file_id: str, person) -> bool:
    """
    Shaxs rasmini yuklaydi:
    1) ImageKit CDN ga urinadi → photo_url o'rnatadi
    2) Agar ImageKit ishlamasa → MEDIA_ROOT ga fallback (disk ephemeral)
    Muvaffaqiyatli bo'lsa True qaytaradi.
    """
    from apps.persons.models import Person as PersonModel

    # --- ImageKit yo'li ---
    url = await upload_tg_photo_to_imagekit(bot, file_id, person.id)
    if url:
        person.photo_url = url
        await PersonModel.objects.filter(pk=person.pk).aupdate(photo_url=url)
        logger.info(f"[photo_utils] person {person.id} photo_url = {url}")
        return True

    # --- Fallback: diskga saqlash ---
    try:
        import os
        from django.conf import settings as djs
        tg_file = await bot.get_file(file_id)
        fpath = os.path.join(djs.MEDIA_ROOT, 'photos', f"bot_{person.id}.jpg")
        os.makedirs(os.path.dirname(fpath), exist_ok=True)
        await tg_file.download_to_drive(fpath)
        person.photo = f"photos/bot_{person.id}.jpg"
        await PersonModel.objects.filter(pk=person.pk).aupdate(photo=person.photo)
        logger.info(f"[photo_utils] person {person.id} disk fallback: {fpath}")
        return True
    except Exception as e:
        logger.warning(f"[photo_utils] disk fallback xato: {e}")
        return False
