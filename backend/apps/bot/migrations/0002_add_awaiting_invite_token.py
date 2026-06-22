from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bot', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='telegramuser',
            name='awaiting_invite_token',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
    ]
