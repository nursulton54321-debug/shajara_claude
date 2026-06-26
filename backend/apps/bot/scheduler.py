"""
APScheduler — kunlik tug'ilgan kun eslatmalari.
Har kuni soat 09:00 da ishga tushadi va Telegram orqali xabar yuboradi.
"""
import logging
from datetime import date

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


async def send_birthday_reminders(bot):
    """Bugun tug'ilgan kunlari bo'lgan shaxslar haqida bot foydalanuvchilarini xabardor qiladi."""
    try:
        import django
        from asgiref.sync import sync_to_async
        from django.db.models import Q
        from apps.persons.models import Person
        from apps.bot.models import TelegramUser

        today = date.today()

        @sync_to_async
        def get_birthdays():
            return list(
                Person.objects.filter(
                    birth_date__month=today.month,
                    birth_date__day=today.day,
                ).values('id', 'first_name', 'last_name', 'birth_date', 'tree__owner')
            )

        @sync_to_async
        def get_active_users():
            return list(TelegramUser.objects.filter(is_active=True).values('telegram_id', 'user'))

        birthdays = await get_birthdays()
        if not birthdays:
            return

        tg_users = await get_active_users()
        if not tg_users:
            return

        for tg_user in tg_users:
            lines = []
            for b in birthdays:
                age = today.year - b['birth_date'].year
                name = f"{b['first_name']} {b['last_name'] or ''}".strip()
                lines.append(f"🎂 {name} — {age} yosh!")

            if lines:
                text = "🎉 Bugungi tug'ilgan kunlar:\n\n" + "\n".join(lines)
                try:
                    await bot.send_message(chat_id=tg_user['telegram_id'], text=text)
                except Exception as e:
                    logger.warning("Xabar yuborib bo'lmadi %s: %s", tg_user['telegram_id'], e)

        logger.info("Birthday reminders yuborildi: %d ta", len(birthdays))
    except Exception as e:
        logger.error("Birthday reminders xatosi: %s", e)


def start_scheduler(bot):
    """Botga scheduler ulaydi — har kuni 09:00 da birthday reminder yuboradi."""
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        send_birthday_reminders,
        trigger=CronTrigger(hour=9, minute=0),
        args=[bot],
        id='birthday_reminders',
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler ishga tushdi — har kuni 09:00 da birthday reminder.")
    return scheduler
