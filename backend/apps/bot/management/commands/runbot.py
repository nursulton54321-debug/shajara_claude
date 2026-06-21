from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Telegram botni polling rejimida ishga tushiradi'

    def handle(self, *args, **options):
        from apps.bot.bot import run_polling
        self.stdout.write(self.style.SUCCESS('Telegram bot ishga tushmoqda...'))
        run_polling()
