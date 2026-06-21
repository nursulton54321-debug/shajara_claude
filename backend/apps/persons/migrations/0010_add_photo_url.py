from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('persons', '0009_remove_spouse_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='person',
            name='photo_url',
            field=models.URLField(blank=True, default=''),
        ),
    ]
