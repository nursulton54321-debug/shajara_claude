from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('persons', '0007_add_slug_linkeduser_invite_push'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ShareLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('is_active', models.BooleanField(default=True)),
                ('note', models.CharField(blank=True, max_length=200)),
                ('view_count', models.PositiveIntegerField(default=0)),
                ('created_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='share_links',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Share Link',
                'ordering': ['-created_at'],
            },
        ),
    ]
