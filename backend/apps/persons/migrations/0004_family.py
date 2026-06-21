from django.db import migrations, models
import django.db.models.deletion


def migrate_spouse_to_family(apps, schema_editor):
    """Person.spouse yozuvlarini Family jadvaliga ko'chirish."""
    Person = apps.get_model('persons', 'Person')
    Family = apps.get_model('persons', 'Family')
    seen   = set()          # takrorni oldini olish

    for person in Person.objects.select_related('spouse').filter(spouse__isnull=False):
        s = person.spouse
        if s is None:
            continue
        # juft tartibini normallashtir (kichigi husband)
        pair = (min(person.id, s.id), max(person.id, s.id))
        if pair in seen:
            continue
        seen.add(pair)

        husband = person if person.gender == 'male' else s
        wife    = s      if person.gender == 'male' else person
        # Agar ikkalasi ham erkak / ikkalasi ham ayol bo'lsa ham id bo'yicha ajratamiz
        if husband.gender != 'male':
            husband, wife = (person, s) if person.id < s.id else (s, person)

        Family.objects.create(
            husband=husband,
            wife=wife,
            order=1,
            is_active=True,
            created_by=husband.created_by,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('persons', '0003_reminder'),
    ]

    operations = [
        migrations.CreateModel(
            name='Family',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('wedding_date',  models.DateField(blank=True, null=True, verbose_name="To'y sanasi")),
                ('divorce_date',  models.DateField(blank=True, null=True, verbose_name='Ajralish sanasi')),
                ('order',         models.PositiveSmallIntegerField(default=1, help_text='Nechanchi nikoh (1,2,3…)')),
                ('note',          models.TextField(blank=True, verbose_name='Izoh')),
                ('is_active',     models.BooleanField(default=True)),
                ('created_at',    models.DateTimeField(auto_now_add=True)),
                ('husband', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                    related_name='families_as_husband', to='persons.person')),
                ('wife',    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                    related_name='families_as_wife',    to='persons.person')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='families', to='users.user')),
            ],
            options={
                'verbose_name': 'Oila',
                'verbose_name_plural': 'Oilalar',
                'ordering': ['wedding_date', 'order'],
            },
        ),
        # Mavjud spouse → Family
        migrations.RunPython(migrate_spouse_to_family, migrations.RunPython.noop),
    ]
