"""
Har kuni ertalab ishga tushadigan management command:
  python manage.py send_birthday_push

Windows Task Scheduler uchun:
  schtasks /create /tn "ShajaraBirthdayPush" /tr "D:\\Loyihalar\\Shajara_claude\\backend\\venv\\Scripts\\python.exe D:\\Loyihalar\\Shajara_claude\\backend\\manage.py send_birthday_push" /sc daily /st 09:00

Linux/macOS cron (crontab -e):
  0 9 * * * /path/to/venv/bin/python /path/to/backend/manage.py send_birthday_push
"""
import json
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from apps.persons.models import Person, PushSubscription


class Command(BaseCommand):
    help = "Yaqin tug'ilgan kunlar uchun barcha foydalanuvchilarga push notification yuboradi"

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, default=3,
            help='Necha kun oldin xabar yuborish (standart: 3)'
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Haqiqatda yubormasdan test qilish'
        )

    def handle(self, *args, **options):
        days_ahead = options['days']
        dry_run    = options['dry_run']
        today      = timezone.now().date()

        self.stdout.write(f"[{today}] Birthday push yuborish boshlanmoqda ({days_ahead} kun oldin)...")

        # Yaqin tug'ilgan kunlar
        upcoming = []
        for p in Person.objects.filter(birth_date__isnull=False, death_date__isnull=True):
            try:
                bd = p.birth_date.replace(year=today.year)
            except ValueError:
                bd = p.birth_date.replace(year=today.year, day=28)
            if bd < today:
                try:
                    bd = bd.replace(year=today.year + 1)
                except ValueError:
                    bd = bd.replace(year=today.year + 1, day=28)
            days_left = (bd - today).days
            if 0 <= days_left <= days_ahead:
                upcoming.append({'person': p, 'days': days_left, 'date': bd})

        if not upcoming:
            self.stdout.write(self.style.WARNING("  Yaqin tug'ilgan kun topilmadi."))
            return

        self.stdout.write(f"  {len(upcoming)} ta yaqin tug'ilgan kun topildi:")
        for b in upcoming:
            self.stdout.write(f"    - {b['person'].full_name}: {b['days']} kun qoldi")

        if dry_run:
            self.stdout.write(self.style.WARNING("  [dry-run] Haqiqatda yuborilmadi."))
            return

        try:
            from pywebpush import webpush, WebPushException
        except ImportError:
            self.stdout.write(self.style.ERROR("  pywebpush o'rnatilmagan! pip install pywebpush"))
            return

        subs = PushSubscription.objects.select_related('user').all()
        sent = 0
        failed = 0

        for sub in subs:
            for b in upcoming:
                if b['days'] == 0:
                    title = "🎂 Bugun tug'ilgan kun!"
                    body  = f"{b['person'].full_name} — bugun tug'ilgan kuni!"
                else:
                    title = f"🎂 {b['days']} kundan so'ng tug'ilgan kun"
                    body  = f"{b['person'].full_name} — {b['days']} kun qoldi"

                payload = json.dumps({
                    'title': title,
                    'body':  body,
                    'icon':  '/favicon.ico',
                    'badge': '/favicon.ico',
                    'data':  {'personId': b['person'].id},
                })
                try:
                    webpush(
                        subscription_info={
                            'endpoint': sub.endpoint,
                            'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                        },
                        data=payload,
                        vapid_private_key=settings.VAPID_PRIVATE_KEY,
                        vapid_claims={
                            'sub': f"mailto:{getattr(settings, 'VAPID_CLAIMS_EMAIL', 'admin@shajara.uz')}"
                        },
                    )
                    sent += 1
                except WebPushException as e:
                    failed += 1
                    if '410' in str(e) or '404' in str(e):
                        sub.delete()
                        self.stdout.write(f"    Eskirgan subscription o'chirildi: {sub.endpoint[:60]}")

        self.stdout.write(self.style.SUCCESS(
            f"  Yuborildi: {sent} ta notification, xato: {failed} ta"
        ))
