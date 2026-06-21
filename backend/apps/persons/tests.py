"""
persons app uchun unit testlar.
Ishga tushirish: python manage.py test apps.persons.tests
"""
import datetime
from django.test import TestCase
from unittest.mock import patch, MagicMock


class DaysUntilTests(TestCase):
    """services.days_until() — yil-mustaqil sana hisoblash."""

    def setUp(self):
        from apps.persons.services import days_until, next_occurrence
        self.days_until      = days_until
        self.next_occurrence = next_occurrence

    def test_same_day(self):
        today = datetime.date(2024, 6, 15)
        d     = datetime.date(1990, 6, 15)
        self.assertEqual(self.days_until(d, today), 0)

    def test_tomorrow(self):
        today = datetime.date(2024, 6, 15)
        d     = datetime.date(1990, 6, 16)
        self.assertEqual(self.days_until(d, today), 1)

    def test_past_this_year_counts_next_year(self):
        today = datetime.date(2024, 6, 15)
        d     = datetime.date(1990, 6, 10)   # o'tib ketgan
        result = self.days_until(d, today)
        # Keyingi yil: 2025-06-10 − 2024-06-15 = 360 kun
        expected = (datetime.date(2025, 6, 10) - today).days
        self.assertEqual(result, expected)

    def test_leap_day_feb29(self):
        """29-fevral tug'ilgan — 28-fevral ga kamaytiradi."""
        today = datetime.date(2024, 3, 1)
        d     = datetime.date(2000, 2, 29)
        result = self.days_until(d, today)
        self.assertGreater(result, 0)   # crash bo'lmasin, natija musbat

    def test_next_occurrence_is_in_future(self):
        today = datetime.date(2024, 6, 15)
        d     = datetime.date(1990, 1, 1)    # o'tib ketgan oy
        nd    = self.next_occurrence(d, today)
        self.assertGreaterEqual(nd, today)


class GetStatisticsTests(TestCase):
    """services.get_statistics() — Person modeli bo'yicha hisob."""

    def test_empty_db(self):
        from apps.persons.services import get_statistics
        stats = get_statistics()
        self.assertEqual(stats['total'],    0)
        self.assertEqual(stats['male'],     0)
        self.assertEqual(stats['female'],   0)
        self.assertEqual(stats['deceased'], 0)
        self.assertEqual(stats['alive'],    0)

    def test_counts_with_persons(self):
        from apps.persons.models import Person
        from apps.persons.services import get_statistics

        Person.objects.create(first_name='Ali',   last_name='Test', gender='male',   child_number=1)
        Person.objects.create(first_name='Barno', last_name='Test', gender='female', child_number=2)
        Person.objects.create(first_name='Vafot', last_name='Test', gender='male',
                              death_date=datetime.date(2000, 1, 1), child_number=3)

        stats = get_statistics()
        self.assertEqual(stats['total'],    3)
        self.assertEqual(stats['male'],     2)
        self.assertEqual(stats['female'],   1)
        self.assertEqual(stats['deceased'], 1)
        self.assertEqual(stats['alive'],    2)

    def test_this_month_birthdays(self):
        from apps.persons.models import Person
        from apps.persons.services import get_statistics
        today = datetime.date.today()

        Person.objects.create(first_name='Bu', last_name='Oy', gender='male', child_number=1,
                              birth_date=datetime.date(1990, today.month, 1))
        Person.objects.create(first_name='Boshqa', last_name='Oy', gender='female', child_number=2,
                              birth_date=datetime.date(1990, (today.month % 12) + 1, 1))

        stats = get_statistics(today=today)
        self.assertGreaterEqual(stats['this_month_birthdays'], 1)


class GenerationDepthTests(TestCase):
    """computeGenerations mantiqini Python'da sinash (TreePage'dan ko'chirilgan)."""

    def _compute(self, persons):
        """
        persons = [{'id':..,'father_id':..,'mother_id':..}, ...]
        Qaytaradi: {person_id: generation_depth}
        """
        pid_map = {p['id']: p for p in persons}
        cache   = {}

        def depth(pid):
            if pid in cache:
                return cache[pid]
            p      = pid_map.get(pid)
            if not p:
                return 0
            fd = depth(p['father_id']) + 1 if p.get('father_id') else 0
            md = depth(p['mother_id']) + 1 if p.get('mother_id') else 0
            cache[pid] = max(fd, md)
            return cache[pid]

        for p in persons:
            depth(p['id'])
        return cache

    def test_single_person(self):
        g = self._compute([{'id': 1, 'father_id': None, 'mother_id': None}])
        self.assertEqual(g[1], 0)

    def test_parent_child(self):
        persons = [
            {'id': 1, 'father_id': None, 'mother_id': None},
            {'id': 2, 'father_id': 1,    'mother_id': None},
        ]
        g = self._compute(persons)
        self.assertEqual(g[1], 0)
        self.assertEqual(g[2], 1)

    def test_three_generations(self):
        persons = [
            {'id': 1, 'father_id': None, 'mother_id': None},
            {'id': 2, 'father_id': 1,    'mother_id': None},
            {'id': 3, 'father_id': 2,    'mother_id': None},
        ]
        g = self._compute(persons)
        self.assertEqual(g[3], 2)

    def test_mixed_parent_depth(self):
        """Father chuqurroq bo'lsa, father depth olinadi."""
        persons = [
            {'id': 1, 'father_id': None, 'mother_id': None},
            {'id': 2, 'father_id': None, 'mother_id': None},
            {'id': 3, 'father_id': 1,    'mother_id': None},
            {'id': 4, 'father_id': None, 'mother_id': None},
            {'id': 5, 'father_id': 3,    'mother_id': 2},    # father_depth=2, mother_depth=1
        ]
        g = self._compute(persons)
        self.assertEqual(g[5], 2)
