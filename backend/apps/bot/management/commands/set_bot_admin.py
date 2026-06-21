"""
python manage.py set_bot_admin <telegram_id> [<django_username>]

Bot uchun birinchi admin (superadmin) qo'lda belgilash.
Bot tokenini olguncha /start ni bosib Telegram ID ni topish mumkin.
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


class Command(BaseCommand):
    help = 'Telegram foydalanuvchini bot admini sifatida belgilash'

    def add_arguments(self, parser):
        parser.add_argument('telegram_id', type=int, help='Telegram chat ID')
        parser.add_argument('full_name',   type=str, help="To'liq ism")
        parser.add_argument(
            '--username', type=str, default=None,
            help='Django username (bo\'lmasa avtomatik yaratiladi)'
        )

    def handle(self, *args, **options):
        from apps.bot.models import TelegramUser
        from apps.users.models import User

        tg_id     = options['telegram_id']
        full_name = options['full_name']
        username  = options.get('username') or f'tg_{tg_id}'

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'first_name':   full_name,
                'role':         'admin',
                'is_superuser': True,
                'is_staff':     True,
            }
        )
        if not created:
            user.role         = 'admin'
            user.is_superuser = True
            user.is_staff     = True
            user.save()

        tg_user, _ = TelegramUser.objects.update_or_create(
            telegram_id=tg_id,
            defaults={
                'full_name':   full_name,
                'user':        user,
                'status':      TelegramUser.STATUS_APPROVED,
                'approved_at': timezone.now(),
            }
        )

        self.stdout.write(self.style.SUCCESS(
            f"Bot admini belgilandi:\n"
            f"   Telegram ID : {tg_id}\n"
            f"   Ism         : {full_name}\n"
            f"   Django user : {username}\n"
            f"   Rol         : superadmin"
        ))
