"""
Shared business logic — bot va veb ikkalasi ham shu funksiyalarni ishlatadi.
"""
import datetime
from django.utils import timezone


def days_until(stored_date, today) -> int:
    """Keyingi yillik uchrashuvga necha kun. Yil-mustaqil."""
    try:
        nd = stored_date.replace(year=today.year)
    except ValueError:
        nd = stored_date.replace(year=today.year, day=28)
    if nd < today:
        try:
            nd = nd.replace(year=today.year + 1)
        except ValueError:
            nd = nd.replace(year=today.year + 1, day=28)
    return (nd - today).days


def next_occurrence(stored_date, today):
    """Keyingi yillik uchrashuv sanasi."""
    try:
        nd = stored_date.replace(year=today.year)
    except ValueError:
        nd = stored_date.replace(year=today.year, day=28)
    if nd < today:
        try:
            nd = nd.replace(year=today.year + 1)
        except ValueError:
            nd = nd.replace(year=today.year + 1, day=28)
    return nd


def get_statistics(today=None):
    """
    Shajara statistikasini dict shaklida qaytaradi.
    Bot va veb bir xil hisoblaydi.
    """
    from .models import Person
    today = today or timezone.now().date()
    qs = Person.objects.all()
    total    = qs.count()
    male     = qs.filter(gender='male').count()
    female   = qs.filter(gender='female').count()
    deceased = qs.filter(death_date__isnull=False).count()
    alive    = qs.filter(death_date__isnull=True).count()
    return {
        'total':    total,
        'male':     male,
        'female':   female,
        'deceased': deceased,
        'alive':    alive,
        'this_month_birthdays': qs.filter(birth_date__month=today.month).count(),
    }


async def collect_reminders(time_f: str, today=None) -> list[dict]:
    """
    Reminder modeli + Person.birth_date fallback.
    Bot va veb bir xil mantiq bilan ishlaydi.
    """
    from .models import Person, Reminder

    today = today or timezone.now().date()
    items: list[dict] = []
    seen_pids: set[int] = set()

    # 1. Reminder modelidan
    async for r in Reminder.objects.filter(is_active=True).select_related('person'):
        p  = r.person
        du = days_until(r.date, today)
        nd = next_occurrence(r.date, today)

        if   time_f == 'today' and du != 0:                     continue
        elif time_f == 'week'  and du > 6:                      continue
        elif time_f == 'month' and r.date.month != today.month: continue

        note = r.note or ''
        if r.type == 'birthday':
            seen_pids.add(p.id)
            age = today.year - r.date.year + (
                0 if (today.month, today.day) <= (r.date.month, r.date.day) else 1
            )
            note = f"{age} yosh bo'ladi"

        items.append({
            'date':        nd,
            'days_until':  du,
            'type':        r.type,
            'icon':        r.icon,
            'person_id':   p.id,
            'person_name': p.full_name,
            'gender':      p.gender,
            'label':       r.get_type_display(),
            'note':        note,
        })

    # 2. Person.birth_date (Reminder DB da yo'q bo'lganlari)
    async for p in Person.objects.filter(
        birth_date__isnull=False, death_date__isnull=True
    ).only('id', 'last_name', 'first_name', 'middle_name', 'birth_date', 'gender'):
        if p.id in seen_pids:
            continue
        bd = p.birth_date
        du = days_until(bd, today)
        nd = next_occurrence(bd, today)

        if   time_f == 'today' and du != 0:                continue
        elif time_f == 'week'  and du > 6:                  continue
        elif time_f == 'month' and bd.month != today.month: continue

        age = today.year - bd.year + (
            0 if (today.month, today.day) <= (bd.month, bd.day) else 1
        )
        items.append({
            'date':        nd,
            'days_until':  du,
            'type':        'birthday',
            'icon':        '🎂',
            'person_id':   p.id,
            'person_name': p.full_name,
            'gender':      p.gender,
            'label':       "Tug'ilgan kun",
            'note':        f"{age} yosh bo'ladi",
        })

    items.sort(key=lambda x: (x['days_until'], x['person_name']))
    return items
