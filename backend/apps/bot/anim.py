"""
Bot animatsiya yordamchisi — yuklanish animatsiyalari.
"""
import asyncio


class Anim:
    """
    Xabarni animatsiya qiluvchi context manager.

    async with Anim(update, frames=[...], interval=0.6) as a:
        # og'ir ish...
        await a.done("✅ Tayyor!")
    """

    def __init__(self, update, frames: list[str], interval: float = 0.55, parse_mode='HTML'):
        self.update    = update
        self.frames    = frames
        self.interval  = interval
        self.parse_mode = parse_mode
        self.msg       = None
        self._task     = None
        self._stopped  = False

    async def __aenter__(self):
        self.msg = await self.update.message.reply_text(
            self.frames[0], parse_mode=self.parse_mode
        )
        self._task = asyncio.create_task(self._loop())
        return self

    async def __aexit__(self, *_):
        self._stopped = True
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _loop(self):
        i = 0
        while not self._stopped:
            await asyncio.sleep(self.interval)
            if self._stopped:
                break
            i = (i + 1) % len(self.frames)
            try:
                await self.msg.edit_text(self.frames[i], parse_mode=self.parse_mode)
            except Exception:
                pass

    async def update_text(self, text: str):
        """Joriy kadrni almashtirish."""
        self._stopped = True
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        try:
            await self.msg.edit_text(text, parse_mode=self.parse_mode)
        except Exception:
            pass

    async def done(self, text: str):
        """Animatsiyani to'xtatib, yakuniy xabarni ko'rsatish."""
        await self.update_text(text)

    async def delete(self):
        """Animatsiya xabarini o'chirish."""
        self._stopped = True
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        try:
            await self.msg.delete()
        except Exception:
            pass


# ── Tayyor animatsiya to'plamlari ────────────────────────────────────────────

def frames_loading(label='Yuklanmoqda'):
    """Nuqtali oddiy yuklanish animatsiyasi."""
    return [
        f"⏳ {label}",
        f"⏳ {label} <b>.</b>",
        f"⏳ {label} <b>. .</b>",
        f"⏳ {label} <b>. . .</b>",
        f"⏳ {label} <b>. .</b>",
        f"⏳ {label} <b>.</b>",
    ]


def _dots(icon: str, label: str) -> list[str]:
    """'icon label ...' nuqtalar animatsiyasi (6 kadr)."""
    return [
        f"{icon} <b>{label}</b>",
        f"{icon} <b>{label} .</b>",
        f"{icon} <b>{label} . .</b>",
        f"{icon} <b>{label} . . .</b>",
        f"{icon} <b>{label} . .</b>",
        f"{icon} <b>{label} .</b>",
    ]


def frames_tree():
    return _dots("🌳", "Shajara daraxti yaratilmoqda")


def frames_stats():
    return _dots("📊", "Statistika hisoblanmoqda")


def frames_persons():
    return _dots("👥", "Ro'yxat tayyorlanmoqda")


def frames_search():
    return _dots("🔍", "Qidirilmoqda")


def frames_reminders():
    return _dots("🔔", "Tug'ilgan kunlar tekshirilmoqda")


def frames_writing():
    return _dots("✍️", "Yozilmoqda")
