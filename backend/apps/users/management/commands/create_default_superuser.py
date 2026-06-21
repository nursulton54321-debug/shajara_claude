from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Create default superuser if not exists'

    def handle(self, *args, **kwargs):
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@shajara.app', 'Admin1234!')
            self.stdout.write(self.style.SUCCESS('Superuser created: admin / Admin1234!'))
        else:
            self.stdout.write('Superuser already exists')
