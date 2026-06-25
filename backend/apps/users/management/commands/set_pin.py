from django.core.management.base import BaseCommand
from apps.users.models import SiteSetting


class Command(BaseCommand):
    help = "Sayt PIN kodini o'rnatish yoki ko'rish"

    def add_arguments(self, parser):
        parser.add_argument('pin', nargs='?', help='Yangi PIN kod')

    def handle(self, *args, **options):
        s = SiteSetting.get()
        new_pin = options.get('pin')
        if new_pin:
            s.site_pin = new_pin
            s.save()
            self.stdout.write(self.style.SUCCESS(f"PIN '{new_pin}' ga o'rnatildi."))
        else:
            self.stdout.write(f"Joriy PIN: {s.site_pin}")
