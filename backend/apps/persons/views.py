import csv, io, json, zipfile, os
from PIL import Image as PilImage
from rest_framework import generics, serializers as drf_serializers, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly
from rest_framework.parsers import MultiPartParser
from django.db.models import Q
from django.utils import timezone
from django.http import HttpResponse
from django.conf import settings
from .models import Person, Reminder, Family, AuditLog, Invite, PushSubscription, ShareLink
from .serializers import (PersonSerializer, PersonShortSerializer, PersonTreeSerializer,
                           ReminderSerializer, FamilySerializer, AuditLogSerializer,
                           InviteSerializer, PublicPersonSerializer)
from .audit import log_action, instance_to_dict, _diff
from apps.users.permissions import IsAdmin


def _upload_to_imagekit(instance):
    """
    Person.photo ni o'qib, ImageKit ga yuklaydi va instance.photo_url ni yangilaydi.
    ImageKit sozlanmagan bo'lsa — lokal fayl saqlanadi (fallback).
    """
    if not instance.photo:
        return
    pk = getattr(settings, 'IMAGEKIT_PRIVATE_KEY', '')
    pub = getattr(settings, 'IMAGEKIT_PUBLIC_KEY', '')
    url_ep = getattr(settings, 'IMAGEKIT_URL_ENDPOINT', '')
    if not (pk and pub and url_ep):
        return  # ImageKit sozlanmagan — lokal fayldan foydalaniladi

    try:
        import io as _io, requests as _req
        log = __import__('logging').getLogger(__name__)

        path = instance.photo.path
        if not os.path.exists(path):
            return
        with PilImage.open(path) as img:
            img = img.convert('RGB')
            img.thumbnail((800, 800), PilImage.LANCZOS)
            buf = _io.BytesIO()
            img.save(buf, 'JPEG', quality=85, optimize=True)
            buf.seek(0)

        fname = f"person_{instance.pk}.jpg"
        resp = _req.post(
            'https://upload.imagekit.io/api/v1/files/upload',
            auth=(pk, ''),  # private key = username, password bo'sh
            files={'file': (fname, buf.getvalue(), 'image/jpeg')},
            data={'fileName': fname, 'folder': '/shajara/photos/'},
            timeout=30,
        )
        log.info(f"[ImageKit] status={resp.status_code} body={resp.text[:200]}")
        if resp.status_code == 200:
            url = resp.json().get('url', '')
            if url:
                instance.photo_url = url
                from .models import Person
                Person.objects.filter(pk=instance.pk).update(photo_url=url)
                log.info(f"[ImageKit] OK: {url}")
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"[ImageKit] xato: {e}")


def _sync_person_reminders(person, user):
    """Shaxsning tug'ilgan kuni va vafot sanasi bo'yicha eslatma yaratadi/yangilaydi."""
    if person.birth_date:
        Reminder.objects.get_or_create(
            person=person, type='birthday',
            defaults={'date': person.birth_date, 'note': f"{person.full_name}ning tug'ilgan kuni", 'is_active': True, 'created_by': user}
        )
        Reminder.objects.filter(person=person, type='birthday').update(date=person.birth_date)
    if person.death_date:
        Reminder.objects.get_or_create(
            person=person, type='death',
            defaults={'date': person.death_date, 'note': f"{person.full_name} vafot etgan sana", 'is_active': True, 'created_by': user}
        )
        Reminder.objects.filter(person=person, type='death').update(date=person.death_date)


class PersonListCreateView(generics.ListCreateAPIView):
    serializer_class = PersonShortSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return PersonSerializer
        return PersonShortSerializer

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        _upload_to_imagekit(instance)
        log_action(self.request, 'create', instance)
        _sync_person_reminders(instance, self.request.user)

    def get_queryset(self):
        qs = Person.objects.all()
        search = self.request.query_params.get('search')
        gender = self.request.query_params.get('gender')
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(middle_name__icontains=search)
            )
        if gender:
            qs = qs.filter(gender=gender)
        return qs


class PersonDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PersonSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    queryset = Person.objects.all()

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAdmin()]
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAuthenticated()]
        return [IsAuthenticatedOrReadOnly()]

    def perform_update(self, serializer):
        old = instance_to_dict(serializer.instance)
        instance = serializer.save()
        _upload_to_imagekit(instance)
        new = instance_to_dict(instance)
        changes = _diff(old, new)
        if changes:
            log_action(self.request, 'update', instance, changes=changes)
        _sync_person_reminders(instance, self.request.user)

    def perform_destroy(self, instance):
        log_action(self.request, 'delete', instance,
                   changes={'repr': str(instance)})
        instance.delete()


class PersonTreeView(APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request):
        persons = Person.objects.all()
        data = PersonTreeSerializer(persons, many=True, context={'request': request}).data
        nodes, edges = [], []
        for p in data:
            nodes.append({'id': str(p['id']), 'type': 'personNode', 'data': p, 'position': {'x': 0, 'y': 0}})
            if p['father_id']:
                edges.append({'id': f"f-{p['id']}", 'source': str(p['father_id']), 'target': str(p['id']), 'type': 'smoothstep'})
            if p['mother_id']:
                edges.append({'id': f"m-{p['id']}", 'source': str(p['mother_id']), 'target': str(p['id']), 'type': 'smoothstep'})
        return Response({'nodes': nodes, 'edges': edges})


class StatisticsView(APIView):
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request):
        from .services import get_statistics
        return Response(get_statistics())


class BirthdaysView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        today = timezone.now().date()
        persons = Person.objects.filter(birth_date__month=today.month, death_date__isnull=True)
        data = PersonShortSerializer(persons, many=True, context={'request': request}).data
        return Response(data)


# ── Reminder views ──────────────────────────────────────────

class ReminderListCreateView(generics.ListCreateAPIView):
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Reminder.objects.select_related('person').all()
        type_filter = self.request.query_params.get('type')
        month       = self.request.query_params.get('month')
        year        = self.request.query_params.get('year')
        active      = self.request.query_params.get('active')
        sort        = self.request.query_params.get('sort', 'nearest')

        if type_filter:
            qs = qs.filter(type=type_filter)
        if month:
            qs = qs.filter(date__month=month)
        if year:
            qs = qs.filter(date__year=year)
        if active == 'true':
            qs = qs.filter(is_active=True)
        elif active == 'false':
            qs = qs.filter(is_active=False)

        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        data = ReminderSerializer(qs, many=True, context={'request': request}).data

        sort = request.query_params.get('sort', 'nearest')
        today = timezone.now().date()

        def days_until(d):
            try:
                nd = d.replace(year=today.year)
            except ValueError:
                nd = d.replace(year=today.year, day=28)
            if nd < today:
                try:
                    nd = nd.replace(year=today.year + 1)
                except ValueError:
                    nd = nd.replace(year=today.year + 1, day=28)
            return (nd - today).days

        import datetime
        if sort == 'nearest':
            data = sorted(data, key=lambda x: days_until(datetime.date.fromisoformat(x['date'])) if x['date'] else 9999)
        elif sort == 'date_asc':
            data = sorted(data, key=lambda x: x['date'] or '')
        elif sort == 'date_desc':
            data = sorted(data, key=lambda x: x['date'] or '', reverse=True)
        elif sort == 'name':
            data = sorted(data, key=lambda x: x['person_name'] or '')

        return Response(data)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ReminderDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Reminder.objects.all()
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated]


class ReminderStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        qs = Reminder.objects.filter(is_active=True)
        in_30 = 0
        for r in qs:
            try:
                if r.days_until <= 30:
                    in_30 += 1
            except Exception:
                pass
        this_month = qs.filter(date__month=today.month).count()
        return Response({
            'total': Reminder.objects.count(),
            'active': qs.count(),
            'next_30_days': in_30,
            'this_month': this_month,
        })


class AutoCreateRemindersView(APIView):
    """Barcha shaxslarning tug'ilgan kunlari uchun avtomatik eslatma yaratish"""
    permission_classes = [IsAdmin]

    def post(self, request):
        persons = Person.objects.filter(birth_date__isnull=False)
        created = 0
        for p in persons:
            exists = Reminder.objects.filter(person=p, type='birthday').exists()
            if not exists:
                Reminder.objects.create(
                    person=p, type='birthday', date=p.birth_date,
                    note=f"{p.full_name}ning tug'ilgan kuni",
                    is_active=True, created_by=request.user
                )
                created += 1
        # Vafot etgan sanalar
        deceased = Person.objects.filter(death_date__isnull=False)
        for p in deceased:
            exists = Reminder.objects.filter(person=p, type='death').exists()
            if not exists:
                Reminder.objects.create(
                    person=p, type='death', date=p.death_date,
                    note=f"{p.full_name} vafot etgan sana",
                    is_active=True, created_by=request.user
                )
                created += 1
        return Response({'created': created, 'message': f"{created} ta eslatma yaratildi"})


# ── Family views ────────────────────────────────────────────────

class FamilyListCreateView(generics.ListCreateAPIView):
    """Oilalar ro'yxati va yangi oila qo'shish."""
    serializer_class   = FamilySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Family.objects.select_related('husband', 'wife').all()
        person_id = self.request.query_params.get('person')
        if person_id:
            from django.db.models import Q
            qs = qs.filter(Q(husband_id=person_id) | Q(wife_id=person_id))
        return qs

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        log_action(self.request, 'create', instance)
        if instance.wedding_date and instance.husband:
            Reminder.objects.get_or_create(
                person=instance.husband,
                type='wedding',
                date=instance.wedding_date,
                defaults={'note': f"To'y kuni — {instance.wife.full_name if instance.wife else ''}", 'created_by': self.request.user}
            )


class FamilyDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Bitta oilani ko'rish, tahrirlash, o'chirish."""
    queryset           = Family.objects.select_related('husband', 'wife')
    serializer_class   = FamilySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAdmin()]
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAuthenticated()]
        return [AllowAny()]


# ── CSV Export ──────────────────────────────────────────────────

class PersonExportCSVView(APIView):
    """Barcha shaxslarni CSV fayl sifatida yuklab olish"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        persons = Person.objects.all().order_by('id')

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="shajara.csv"'
        response.write('﻿')  # UTF-8 BOM for Excel

        writer = csv.writer(response)
        writer.writerow([
            'id', 'familiya', 'ism', 'otasining_ismi',
            'jins', 'tugulgan_sana', 'vafot_sana',
            'telefon', 'nechanchi_farzand',
            'ota_id', 'ona_id', 'juft_id',
        ])
        for p in persons:
            writer.writerow([
                p.id, p.last_name or '', p.first_name or '', p.middle_name or '',
                p.gender or '', p.birth_date or '', p.death_date or '',
                p.phone or '', p.child_number or '',
                p.father_id or '', p.mother_id or '', p.spouse_id or '',
            ])
        log_action(request, 'export', model_name='CSV',
                   changes={'rows': persons.count()})
        return response


# ── CSV Import ──────────────────────────────────────────────────

class PersonImportCSVView(APIView):
    """CSV fayldan shaxslarni yuklab olish"""
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser]

    def post(self, request):
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'error': 'CSV fayl yuklanmadi'}, status=400)

        try:
            content = csv_file.read().decode('utf-8-sig')  # handle BOM
            reader = csv.DictReader(io.StringIO(content))

            created_count = 0
            updated_count = 0
            errors = []

            for row_num, row in enumerate(reader, start=2):
                try:
                    # Map CSV columns
                    pk = row.get('id', '').strip()
                    data = {
                        'first_name':   row.get('ism', '').strip(),
                        'last_name':    row.get('familiya', '').strip(),
                        'middle_name':  row.get('otasining_ismi', '').strip(),
                        'gender':       row.get('jins', 'male').strip() or 'male',
                        'phone':        row.get('telefon', '').strip() or None,
                    }
                    birth = row.get('tugulgan_sana', '').strip()
                    death = row.get('vafot_sana', '').strip()
                    cn    = row.get('nechanchi_farzand', '').strip()
                    if birth: data['birth_date'] = birth
                    if death: data['death_date'] = death
                    if cn:    data['child_number'] = int(cn)

                    if pk:
                        obj, created = Person.objects.update_or_create(
                            pk=int(pk), defaults={**data, 'created_by': request.user}
                        )
                        if created: created_count += 1
                        else:       updated_count += 1
                    else:
                        Person.objects.create(**data, created_by=request.user)
                        created_count += 1

                except Exception as e:
                    errors.append(f"Satr {row_num}: {str(e)}")

            log_action(request, 'import', model_name='CSV',
                       changes={'created': created_count, 'updated': updated_count,
                                'errors': len(errors)})
            return Response({
                'created': created_count,
                'updated': updated_count,
                'errors':  errors,
                'message': f"{created_count} ta qo'shildi, {updated_count} ta yangilandi",
            })
        except Exception as e:
            return Response({'error': str(e)}, status=400)


# ── Backup ZIP eksport ──────────────────────────────────────────

class BackupZipView(APIView):
    """Barcha ma'lumotlar + rasmlar ZIP faylda yuklab olish"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        buf = io.BytesIO()
        today = timezone.now().strftime('%Y-%m-%d')

        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:

            # ── 1. persons.json ──────────────────────────────────
            persons = Person.objects.all().order_by('id')
            persons_data = []
            for p in persons:
                photo_filename = None
                if p.photo:
                    try:
                        photo_filename = f"photos/{os.path.basename(p.photo.name)}"
                    except Exception:
                        pass
                persons_data.append({
                    'id':           p.id,
                    'first_name':   p.first_name or '',
                    'last_name':    p.last_name or '',
                    'middle_name':  p.middle_name or '',
                    'full_name':    p.full_name,
                    'gender':       p.gender or '',
                    'birth_date':   str(p.birth_date)  if p.birth_date  else None,
                    'death_date':   str(p.death_date)  if p.death_date  else None,
                    'birth_place':  p.birth_place or '',
                    'phone':        p.phone or '',
                    'child_number': p.child_number,
                    'father_id':    p.father_id,
                    'mother_id':    p.mother_id,
                    'photo_file':   photo_filename,
                })
            zf.writestr('persons.json',
                json.dumps(persons_data, ensure_ascii=False, indent=2))

            # ── 2. families.json ─────────────────────────────────
            families = Family.objects.select_related('husband', 'wife').all()
            families_data = []
            for f in families:
                families_data.append({
                    'id':           f.id,
                    'husband_id':   f.husband_id,
                    'husband_name': f.husband.full_name if f.husband else '',
                    'wife_id':      f.wife_id,
                    'wife_name':    f.wife.full_name if f.wife else '',
                    'wedding_date': str(f.wedding_date) if f.wedding_date else None,
                    'divorce_date': str(f.divorce_date) if f.divorce_date else None,
                    'is_divorced':  f.is_divorced,
                    'is_active':    f.is_active,
                    'note':         f.note or '',
                    'order':        f.order,
                })
            zf.writestr('families.json',
                json.dumps(families_data, ensure_ascii=False, indent=2))

            # ── 3. README.txt ─────────────────────────────────────
            readme = (
                f"Shajara Backup — {today}\n"
                f"{'='*40}\n\n"
                f"Fayllar:\n"
                f"  persons.json  — {len(persons_data)} ta shaxs ma'lumotlari\n"
                f"  families.json — {len(families_data)} ta oila ma'lumotlari\n"
                f"  photos/       — shaxslar rasmlari\n\n"
                f"Qayta yuklash uchun CSV import funksiyasidan foydalaning.\n"
            )
            zf.writestr('README.txt', readme)

            # ── 4. Rasmlar ────────────────────────────────────────
            for p in persons:
                if not p.photo:
                    continue
                try:
                    photo_path = p.photo.path
                    if os.path.exists(photo_path):
                        arcname = f"photos/{os.path.basename(photo_path)}"
                        zf.write(photo_path, arcname)
                except Exception:
                    pass

        buf.seek(0)
        response = HttpResponse(buf.read(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="shajara-backup-{today}.zip"'
        log_action(request, 'export', model_name='Backup',
                   changes={'persons': len(persons_data), 'families': len(families_data)})
        return response


class ImportZipView(APIView):
    """ZIP backup'dan ma'lumotlarni tiklash"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'Fayl yuklanmadi'}, status=400)
        if not file.name.endswith('.zip'):
            return Response({'error': 'ZIP fayl yuklang'}, status=400)

        try:
            buf = io.BytesIO(file.read())
            with zipfile.ZipFile(buf, 'r') as zf:
                names = zf.namelist()

                # ── 1. persons.json ──────────────────────────────
                if 'persons.json' not in names:
                    return Response({'error': 'persons.json topilmadi'}, status=400)

                persons_data = json.loads(zf.read('persons.json').decode('utf-8'))

                # Avval rasmlarni saqlash (id → path mapping)
                photo_map = {}
                for name in names:
                    if name.startswith('photos/') and name != 'photos/':
                        fname = os.path.basename(name)
                        if fname:
                            img_buf = io.BytesIO(zf.read(name))
                            from django.core.files.base import ContentFile
                            photo_map[fname] = ContentFile(img_buf.read(), name=fname)

                # Shaxslarni yaratish (2 bosqich: avval parent yo'q, keyin bog'lash)
                id_map = {}  # old_id → new Person

                # 1-bosqich: father_id/mother_id siz yaratish
                for pd in persons_data:
                    old_id = pd['id']
                    p, _ = Person.objects.get_or_create(
                        first_name=pd.get('first_name', ''),
                        last_name=pd.get('last_name', ''),
                        middle_name=pd.get('middle_name', '') or '',
                        gender=pd.get('gender', ''),
                        birth_date=pd.get('birth_date') or None,
                        defaults={
                            'death_date':  pd.get('death_date') or None,
                            'birth_place': pd.get('birth_place', '') or '',
                            'phone':       pd.get('phone', '') or '',
                            'child_number':pd.get('child_number') or 0,
                        }
                    )
                    id_map[old_id] = p

                    # Rasm
                    photo_fname = os.path.basename(pd.get('photo_file') or '')
                    if photo_fname and photo_fname in photo_map and not p.photo:
                        p.photo.save(photo_fname, photo_map[photo_fname], save=True)

                # 2-bosqich: ota-ona bog'lash
                for pd in persons_data:
                    p = id_map.get(pd['id'])
                    if not p:
                        continue
                    changed = False
                    if pd.get('father_id') and pd['father_id'] in id_map:
                        p.father = id_map[pd['father_id']]
                        changed = True
                    if pd.get('mother_id') and pd['mother_id'] in id_map:
                        p.mother = id_map[pd['mother_id']]
                        changed = True
                    if changed:
                        p.save(update_fields=['father', 'mother'])

                # ── 2. families.json ─────────────────────────────
                created_fam = 0
                if 'families.json' in names:
                    families_data = json.loads(zf.read('families.json').decode('utf-8'))
                    for fd in families_data:
                        h = id_map.get(fd.get('husband_id'))
                        w = id_map.get(fd.get('wife_id'))
                        if h or w:
                            Family.objects.get_or_create(
                                husband=h, wife=w,
                                defaults={
                                    'wedding_date': fd.get('wedding_date') or None,
                                    'divorce_date': fd.get('divorce_date') or None,
                                    'is_divorced':  fd.get('is_divorced', False),
                                    'is_active':    fd.get('is_active', True),
                                    'note':         fd.get('note', '') or '',
                                    'order':        fd.get('order', 0) or 0,
                                }
                            )
                            created_fam += 1

            log_action(request, 'import', model_name='Backup',
                       changes={'persons': len(persons_data), 'families': created_fam})
            return Response({'persons': len(persons_data), 'families': created_fam})

        except zipfile.BadZipFile:
            return Response({'error': 'Noto\'g\'ri ZIP fayl'}, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


# ── Audit Log ──────────────────────────────────────────────────

class AuditLogListView(APIView):
    """Audit log ro'yxati — faqat adminlar."""
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = AuditLog.objects.select_related('user').all()

        # Filters
        action     = request.query_params.get('action')
        model_name = request.query_params.get('model')
        user_id    = request.query_params.get('user')
        date_from  = request.query_params.get('date_from')   # YYYY-MM-DD
        date_to    = request.query_params.get('date_to')
        search     = request.query_params.get('search')

        if action:
            qs = qs.filter(action=action)
        if model_name:
            qs = qs.filter(model_name__iexact=model_name)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if date_from:
            qs = qs.filter(timestamp__date__gte=date_from)
        if date_to:
            qs = qs.filter(timestamp__date__lte=date_to)
        if search:
            qs = qs.filter(
                Q(object_repr__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(user__username__icontains=search)
            )

        # Pagination
        page_size = int(request.query_params.get('page_size', 50))
        page      = int(request.query_params.get('page', 1))
        total     = qs.count()
        start     = (page - 1) * page_size
        qs        = qs[start : start + page_size]

        data = AuditLogSerializer(qs, many=True).data
        return Response({'count': total, 'page': page,
                         'pages': (total + page_size - 1) // page_size, 'results': data})


# ── 5.2 "Siz bilarmidingiz?" ────────────────────────────────────

class DidYouKnowView(APIView):
    """Tasodifiy qiziqarli fakt qaytaradi."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import random
        facts = []
        persons = list(Person.objects.all())
        if not persons:
            return Response({'fact': 'Hali shaxslar kiritilmagan.', 'icon': '🌱'})

        today = timezone.now().date()

        # 1. Eng katta yoshli (tirik)
        alive_with_birth = [p for p in persons if p.birth_date and not p.death_date]
        if alive_with_birth:
            oldest = max(alive_with_birth, key=lambda p: p.birth_date and (today - p.birth_date).days or 0,
                         default=None)
            if oldest and oldest.birth_date:
                age = (today - oldest.birth_date).days // 365
                facts.append({
                    'icon': '👴',
                    'fact': f"Eng katta yoshli a'zo — {oldest.full_name}, u {age} yoshda!",
                    'person_id': oldest.id,
                })

        # 2. Eng uzun umr ko'rgan (vafot etgan)
        deceased = [p for p in persons if p.birth_date and p.death_date]
        if deceased:
            longest = max(deceased, key=lambda p: (p.death_date - p.birth_date).days)
            age = (longest.death_date - longest.birth_date).days // 365
            facts.append({
                'icon': '🕯️',
                'fact': f"{longest.full_name} eng uzun umr ko'rgan — {age} yoshda vafot etgan.",
                'person_id': longest.id,
            })

        # 3. Eng ko'p farzandli
        from django.db.models import Count
        top_parent = (Person.objects
            .annotate(ch=Count('children_as_father') + Count('children_as_mother'))
            .order_by('-ch').first())
        if top_parent and top_parent.ch > 0:
            facts.append({
                'icon': '👨‍👩‍👧‍👦',
                'fact': f"{top_parent.full_name} — eng ko'p farzandli: {top_parent.ch} nafar farzand.",
                'person_id': top_parent.id,
            })

        # 4. Bugun tug'ilgan kun
        today_bd = [p for p in persons
                    if p.birth_date and p.birth_date.month == today.month and p.birth_date.day == today.day]
        if today_bd:
            p = random.choice(today_bd)
            age = today.year - p.birth_date.year
            facts.append({
                'icon': '🎂',
                'fact': f"Bugun {p.full_name}ning tug'ilgan kuni! Unga {age} yosh to'ldi.",
                'person_id': p.id,
            })

        # 5. Jami statistika
        total = len(persons)
        alive = sum(1 for p in persons if not p.death_date)
        gens  = len(set(p.birth_date.year // 25 for p in persons if p.birth_date))
        facts.append({
            'icon': '🌳',
            'fact': f"Shajarangizda jami {total} ta shaxs, shulardan {alive} tasi hozir hayot.",
        })

        # 6. Eng yosh a'zo (tirik)
        if alive_with_birth:
            youngest = min(alive_with_birth, key=lambda p: p.birth_date)
            age = (today - youngest.birth_date).days // 365
            if age < 18:
                facts.append({
                    'icon': '👶',
                    'fact': f"Eng yosh a'zo — {youngest.full_name}, {age} yoshda.",
                    'person_id': youngest.id,
                })

        # 7. Bir xil tug'ilgan yil
        from collections import Counter
        birth_years = Counter(p.birth_date.year for p in persons if p.birth_date)
        if birth_years:
            top_year, top_count = birth_years.most_common(1)[0]
            if top_count > 1:
                facts.append({
                    'icon': '📅',
                    'fact': f"{top_year} yilda eng ko'p shaxs tug'ilgan — {top_count} nafar.",
                })

        # 8. Eng ko'p tarqalgan ism
        from collections import Counter as Cnt
        names = Cnt(p.first_name for p in persons if p.first_name)
        if names:
            top_name, top_cnt = names.most_common(1)[0]
            if top_cnt > 1:
                facts.append({
                    'icon': '📛',
                    'fact': f"Eng ko'p uchraydigan ism — '{top_name}': {top_cnt} nafar.",
                })

        chosen = random.choice(facts) if facts else {'icon': '🌿', 'fact': 'Shajarangiz kengayib bormoqda!'}
        return Response(chosen)


# ── 4.1 Invite ─────────────────────────────────────────────────

class InviteListCreateView(APIView):
    """Admin: invite yaratish va ro'yxatini ko'rish."""
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = Invite.objects.select_related('person', 'created_by', 'used_by').all()
        return Response(InviteSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        person_id = request.data.get('person')
        note      = request.data.get('note', '')
        days      = request.data.get('expires_days')  # optional
        person = None
        if person_id:
            try:
                person = Person.objects.get(pk=person_id)
            except Person.DoesNotExist:
                return Response({'error': 'Shaxs topilmadi'}, status=400)
        expires_at = None
        if days:
            expires_at = timezone.now() + timezone.timedelta(days=int(days))
        invite = Invite.objects.create(
            person=person, note=note,
            created_by=request.user, expires_at=expires_at
        )
        return Response(InviteSerializer(invite, context={'request': request}).data, status=201)


class InviteDetailView(APIView):
    """Admin: invite o'chirish."""
    permission_classes = [IsAdmin]

    def delete(self, request, pk):
        try:
            Invite.objects.get(pk=pk, created_by=request.user).delete()
        except Invite.DoesNotExist:
            pass
        return Response(status=204)


class InviteTokenView(APIView):
    """Public: token bo'yicha invite ma'lumoti (ro'yxatdan o'tish sahifasi uchun)."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            invite = Invite.objects.select_related('person').get(token=token)
        except Invite.DoesNotExist:
            return Response({'error': 'Invite topilmadi'}, status=404)
        if not invite.is_valid:
            return Response({'error': 'Invite muddati o\'tgan yoki ishlatilgan'}, status=400)
        data = {
            'token':       str(invite.token),
            'note':        invite.note,
            'person_name': invite.person.full_name if invite.person else None,
            'person_id':   invite.person.pk        if invite.person else None,
            'expires_at':  invite.expires_at,
        }
        return Response(data)


# ── 4.2 My Profile ─────────────────────────────────────────────

class MyProfileView(APIView):
    """Foydalanuvchi o'zini shaxs bilan bog'laydi / ko'radi."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            person = request.user.linked_person
            return Response(PersonSerializer(person, context={'request': request}).data)
        except Exception:
            return Response(None)

    def post(self, request):
        """person_id orqali o'zini bog'lash."""
        person_id = request.data.get('person_id')
        if not person_id:
            # bog'liqlikni uzish
            Person.objects.filter(linked_user=request.user).update(linked_user=None)
            return Response({'detail': 'Bog\'liqlik uzildi'})
        try:
            person = Person.objects.get(pk=person_id)
        except Person.DoesNotExist:
            return Response({'error': 'Shaxs topilmadi'}, status=404)
        # Eski bog'liqni tozalash
        Person.objects.filter(linked_user=request.user).update(linked_user=None)
        person.linked_user = request.user
        person.save(update_fields=['linked_user'])
        return Response(PersonSerializer(person, context={'request': request}).data)


# ── 4.3 Public Profile /p/<slug> ───────────────────────────────

class PublicPersonView(APIView):
    """Autentifikatsiyasiz public shaxs profili."""
    permission_classes = [AllowAny]

    def get(self, request, slug):
        try:
            person = Person.objects.get(slug=slug)
        except Person.DoesNotExist:
            return Response({'error': 'Shaxs topilmadi'}, status=404)
        return Response(PublicPersonSerializer(person, context={'request': request}).data)


# ── 4.4 Push Notifications ─────────────────────────────────────

class PushVapidKeyView(APIView):
    """Public VAPID public key — browser subscription uchun."""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'public_key': settings.VAPID_PUBLIC_KEY})


class PushSubscribeView(APIView):
    """Foydalanuvchi push subscription saqlaydi / o'chiradi."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = request.data.get('endpoint')
        p256dh   = request.data.get('keys', {}).get('p256dh', '')
        auth     = request.data.get('keys', {}).get('auth', '')
        if not endpoint:
            return Response({'error': 'endpoint majburiy'}, status=400)
        sub, created = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={'user': request.user, 'p256dh': p256dh, 'auth': auth}
        )
        return Response({'status': 'subscribed', 'created': created})

    def delete(self, request):
        endpoint = request.data.get('endpoint')
        if endpoint:
            PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response({'status': 'unsubscribed'})


class PushSendBirthdaysView(APIView):
    """Yaqin kelayotgan tug'ilgan kunlar uchun push yuborish (foydalanuvchi so'rovida)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from pywebpush import webpush, WebPushException
        import json as _json

        days_ahead = int(request.data.get('days', 7))
        today = timezone.now().date()
        upcoming = []
        for p in Person.objects.filter(birth_date__isnull=False, death_date__isnull=True):
            try:
                bd = p.birth_date.replace(year=today.year)
            except ValueError:
                bd = p.birth_date.replace(year=today.year, day=28)
            if bd < today:
                try:
                    bd = bd.replace(year=today.year + 1)
                except ValueError:
                    bd = bd.replace(year=today.year + 1, day=28)
            days_left = (bd - today).days
            if 0 <= days_left <= days_ahead:
                upcoming.append({'name': p.full_name, 'days': days_left, 'date': str(bd)})

        if not upcoming:
            return Response({'sent': 0, 'message': 'Yaqin tug\'ilgan kun yo\'q'})

        # Foydalanuvchining subscriptionlari
        subs = PushSubscription.objects.filter(user=request.user)
        sent = 0
        errors = []
        for sub in subs:
            for b in upcoming:
                title = "🎂 Tug'ilgan kun!" if b['days'] == 0 else f"🎂 {b['days']} kun qoldi"
                body  = f"{b['name']}{' — bugun!' if b['days'] == 0 else f' — {b[chr(100)+(chr(97))+(chr(116))+(chr(101))]}'}"
                payload = _json.dumps({'title': title, 'body': body, 'icon': '/favicon.ico'})
                try:
                    webpush(
                        subscription_info={
                            'endpoint': sub.endpoint,
                            'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                        },
                        data=payload,
                        vapid_private_key=settings.VAPID_PRIVATE_KEY,
                        vapid_claims={'sub': f'mailto:{settings.VAPID_CLAIMS_EMAIL}'},
                    )
                    sent += 1
                except WebPushException as e:
                    errors.append(str(e)[:80])
                    if '410' in str(e) or '404' in str(e):
                        sub.delete()  # subscription eskiriib qolgan — o'chiramiz

        return Response({'sent': sent, 'upcoming': upcoming, 'errors': errors})


# ── 11. Cron: Har kuni ertalab push yuborish (barcha foydalanuvchilarga) ──

class CronBirthdayPushView(APIView):
    """
    Tizim cron jobi uchun: barcha foydalanuvchilarning
    subscriptionlariga yaqin tug'ilgan kunlar haqida push yuboradi.
    X-Cron-Secret header bilan himoyalangan.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        secret = request.headers.get('X-Cron-Secret', '')
        expected = getattr(settings, 'CRON_SECRET', 'shajara-cron-2024')
        if secret != expected:
            return Response({'error': 'Ruxsat yoq'}, status=403)

        from pywebpush import webpush, WebPushException
        import json as _json

        days_ahead = int(request.data.get('days', 3))
        today = timezone.now().date()

        # Yaqin tug'ilgan kunlar
        upcoming = []
        for p in Person.objects.filter(birth_date__isnull=False, death_date__isnull=True):
            try:
                bd = p.birth_date.replace(year=today.year)
            except ValueError:
                bd = p.birth_date.replace(year=today.year, day=28)
            if bd < today:
                try:
                    bd = bd.replace(year=today.year + 1)
                except ValueError:
                    bd = bd.replace(year=today.year + 1, day=28)
            days_left = (bd - today).days
            if 0 <= days_left <= days_ahead:
                upcoming.append({'name': p.full_name, 'days': days_left, 'id': p.id})

        if not upcoming:
            return Response({'sent': 0, 'message': "Yaqin tug'ilgan kun yo'q"})

        # Barcha subscriptionlarga yuborish
        subs = PushSubscription.objects.select_related('user').all()
        sent = 0
        for sub in subs:
            for b in upcoming:
                if b['days'] == 0:
                    title = "🎂 Bugun tug'ilgan kun!"
                    body  = f"{b['name']} — bugun tug'ilgan kuni!"
                else:
                    title = f"🎂 {b['days']} kundan so'ng tug'ilgan kun"
                    body  = f"{b['name']} — {b['days']} kun qoldi"
                payload = _json.dumps({
                    'title': title, 'body': body,
                    'icon': '/favicon.ico', 'badge': '/favicon.ico',
                    'data': {'personId': b['id']},
                })
                try:
                    webpush(
                        subscription_info={'endpoint': sub.endpoint, 'keys': {'p256dh': sub.p256dh, 'auth': sub.auth}},
                        data=payload,
                        vapid_private_key=settings.VAPID_PRIVATE_KEY,
                        vapid_claims={'sub': f"mailto:{getattr(settings, 'VAPID_CLAIMS_EMAIL', 'admin@shajara.uz')}"},
                    )
                    sent += 1
                except WebPushException as e:
                    if '410' in str(e) or '404' in str(e):
                        sub.delete()

        return Response({'sent': sent, 'upcoming': len(upcoming), 'subscriptions': subs.count()})


# ── 12. Share Link ──────────────────────────────────────────────────

class ShareLinkListCreateView(APIView):
    """Foydalanuvchi o'z share linklarini yaratadi va ko'radi."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        links = ShareLink.objects.filter(created_by=request.user).order_by('-created_at')[:10]
        data = [{
            'id':         lnk.id,
            'token':      str(lnk.token),
            'created_at': lnk.created_at.isoformat(),
            'expires_at': lnk.expires_at.isoformat(),
            'is_active':  lnk.is_active,
            'is_valid':   lnk.is_valid,
            'view_count': lnk.view_count,
            'note':       lnk.note,
            'url':        request.build_absolute_uri(f'/s/{lnk.token}'),
        } for lnk in links]
        return Response(data)

    def post(self, request):
        days = int(request.data.get('days', 7))
        note = request.data.get('note', '')
        lnk = ShareLink.objects.create(
            created_by=request.user,
            expires_at=timezone.now() + timezone.timedelta(days=days),
            note=note,
        )
        return Response({
            'id':         lnk.id,
            'token':      str(lnk.token),
            'expires_at': lnk.expires_at.isoformat(),
            'url':        request.build_absolute_uri(f'/s/{lnk.token}'),
        }, status=201)

    def delete(self, request):
        pk = request.data.get('id')
        if pk:
            ShareLink.objects.filter(pk=pk, created_by=request.user).delete()
        return Response(status=204)


class PublicTreeView(APIView):
    """
    Token bilan umumiy shajara ko'rinishi — login talab qilmaydi.
    Shaxslarning nomi, sanasi, rasmi — telefon raqami YO'Q.
    """
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            lnk = ShareLink.objects.select_related('created_by').get(token=token)
        except ShareLink.DoesNotExist:
            return Response({'error': 'Havola topilmadi'}, status=404)

        if not lnk.is_valid:
            return Response({'error': 'Havolaning muddati tugagan yoki u o\'chirilgan'}, status=410)

        # Ko'rishlar sonini oshiramiz
        ShareLink.objects.filter(pk=lnk.pk).update(view_count=models.F('view_count') + 1)

        # Shaxslar — telefon raqamisiz
        persons = Person.objects.filter(created_by=lnk.created_by).order_by('birth_date')
        data = []
        for p in persons:
            photo_url = None
            if p.photo:
                try:
                    photo_url = request.build_absolute_uri(p.photo.url)
                except Exception:
                    pass
            data.append({
                'id':          p.id,
                'full_name':   p.full_name,
                'gender':      p.gender,
                'birth_date':  str(p.birth_date)  if p.birth_date  else None,
                'death_date':  str(p.death_date)  if p.death_date  else None,
                'birth_place': p.birth_place or '',
                'child_number': p.child_number,
                'photo_url':   photo_url,
                'father_id':   p.father_id,
                'mother_id':   p.mother_id,
                'families':    [{'partner_id': f.wife_id if p.gender == 'male' else f.husband_id}
                                for f in list(p.families_as_husband.all()) + list(p.families_as_wife.all())],
            })

        return Response({
            'owner':      lnk.created_by.get_full_name() or lnk.created_by.username,
            'expires_at': lnk.expires_at.isoformat(),
            'persons':    data,
            'total':      len(data),
        })


# ── 15. AI Relationship Explainer ──────────────────────────────────

def _rel_template(name_a, name_b, relation_label, lca_name, depth_a, depth_b, path_names):
    """
    Gemini API bo'lmasa ham ishlaydi — O'zbekcha matn generatsiyasi.
    """
    parts = []

    if lca_name and depth_a > 0 and depth_b > 0:
        if depth_a == 1 and depth_b == 1:
            parts.append(
                f"{name_a} va {name_b} ikkalasi ham {lca_name}ning bevosita farzandlari. "
                f"Bu degani ular aka-uka yoki opa-singil bo'lishadi."
            )
        elif depth_a == 0:
            parts.append(
                f"{name_a} — {name_b}ning to'g'ridan-to'g'ri ajdodi. "
                f"Ular orasida {depth_b} avlod farqi mavjud."
            )
        elif depth_b == 0:
            parts.append(
                f"{name_b} — {name_a}ning to'g'ridan-to'g'ri avlodi. "
                f"Ular orasida {depth_a} avlod farqi mavjud."
            )
        else:
            parts.append(
                f"{name_a} va {name_b}ning umumiy ajdodi — {lca_name}. "
                f"{name_a} bu ajdoddan {depth_a} pog'ona, {name_b} esa {depth_b} pog'ona pastda turadi."
            )
    elif lca_name:
        parts.append(f"Ularning oilaviy bog'lanishi {lca_name} orqali o'tadi.")

    parts.append(
        f"Xulosa qilib aytganda: {name_a} — {name_b}ning "
        f"{relation_label.lower()} hisoblanadi."
    )

    if path_names and len(path_names) >= 3:
        chain = ' → '.join(path_names)
        parts.append(f"Oila zanjiri bo'yicha yo'l: {chain}.")

    return ' '.join(parts)


def _gemini_client():
    """Yangi google-genai SDK client qaytaradi."""
    from google import genai as google_genai
    api_key = getattr(settings, 'GEMINI_API_KEY', '')
    return google_genai.Client(api_key=api_key)

# Sinab ko'riladigan modellar (birinchi ishlaydigani tanlanadi)
GEMINI_MODELS_PRIORITY = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
]
GEMINI_MODEL = 'gemini-2.0-flash'  # default

# Groq modellari (bepul fallback)
GROQ_MODELS_PRIORITY = [
    'llama-3.3-70b-versatile',   # eng yaxshi instruksiya bajaruvchi
    'llama-3.1-70b-versatile',   # fallback 70b
    'llama3-70b-8192',           # eski 70b
    'llama-3.1-8b-instant',      # tez lekin zaif
    'gemma2-9b-it',
]


def _groq_call(prompt, system_prompt=None):
    """Groq API orqali matn generatsiya (Gemini ishlamasa fallback)."""
    from groq import Groq
    api_key = getattr(settings, 'GROQ_API_KEY', '')
    if not api_key:
        raise Exception('GROQ_API_KEY sozlanmagan')
    client = Groq(api_key=api_key)
    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    messages.append({'role': 'user', 'content': prompt})
    last_err = None
    for model in GROQ_MODELS_PRIORITY:
        try:
            resp = client.chat.completions.create(
                model=model, messages=messages,
                max_tokens=1024, temperature=0.7,
            )
            return resp.choices[0].message.content.strip(), f'groq/{model}'
        except Exception as e:
            last_err = e
            continue
    raise last_err


def _groq_chat(system_prompt, history, message):
    """Groq orqali chat (Gemini chat ishlamasa fallback)."""
    from groq import Groq
    api_key = getattr(settings, 'GROQ_API_KEY', '')
    if not api_key:
        raise Exception('GROQ_API_KEY sozlanmagan')
    client = Groq(api_key=api_key)
    messages = [{'role': 'system', 'content': system_prompt}]
    for h in history:
        messages.append({'role': h['role'], 'content': h['text']})
    messages.append({'role': 'user', 'content': message})
    last_err = None
    for model in GROQ_MODELS_PRIORITY:
        try:
            resp = client.chat.completions.create(
                model=model, messages=messages,
                max_tokens=1024, temperature=0.7,
            )
            return resp.choices[0].message.content.strip(), f'groq/{model}'
        except Exception as e:
            last_err = e
            continue
    raise last_err


def _ai_call(prompt, system_prompt=None, img_bytes=None, img_mime=None):
    """
    Universal AI chaqiruv: Gemini → Groq → template.
    Qaytaradi: (text, source_label)
    """
    # 1. Gemini sinash
    gemini_key = getattr(settings, 'GEMINI_API_KEY', '')
    if gemini_key:
        try:
            client = _gemini_client()
            text, model = _gemini_call(client, prompt, img_bytes=img_bytes, img_mime=img_mime)
            return text, model
        except Exception as e:
            err = str(e)
            # Rasm bo'lsa Groq qo'llab-quvvatlamaydi
            if img_bytes:
                raise e

    # 2. Groq fallback (faqat matn uchun)
    groq_key = getattr(settings, 'GROQ_API_KEY', '')
    if groq_key and not img_bytes:
        try:
            text, model = _groq_call(prompt, system_prompt=system_prompt)
            return text, model
        except Exception:
            pass

    raise Exception('Hech qanday AI xizmati ishlamadi')


def _ai_chat(system_prompt, history, message):
    """
    Universal AI chat: Gemini → Groq fallback.
    """
    import logging
    log = logging.getLogger(__name__)

    # 1. Gemini sinash
    gemini_key = getattr(settings, 'GEMINI_API_KEY', '')
    if gemini_key:
        try:
            client = _gemini_client()
            text, model = _gemini_chat(client, system_prompt, history, message)
            return text, model
        except Exception as e:
            log.warning(f"[AI] Gemini xato: {e}")

    # 2. Groq fallback
    groq_key = getattr(settings, 'GROQ_API_KEY', '')
    log.info(f"[AI] GROQ_API_KEY mavjud: {bool(groq_key)}, kalit: {groq_key[:15] if groq_key else 'YOQ'}")
    if groq_key:
        try:
            text, model = _groq_chat(system_prompt, history, message)
            return text, model
        except Exception as e:
            log.warning(f"[AI] Groq xato: {e}")
            raise Exception(f'Groq xato: {e}')

    raise Exception('Hech qanday AI xizmati ishlamadi — GROQ_API_KEY yo\'q')


def _gemini_call(client, prompt, img_bytes=None, img_mime=None):
    """
    Modellar bo'ylab sinab, birinchi ishlaganida natija qaytaradi.
    img_bytes berilsa — multimodal (OCR) chaqiruv.
    """
    from google.genai import types as gt

    last_err = None
    for model in GEMINI_MODELS_PRIORITY:
        try:
            if img_bytes:
                contents = [
                    gt.Part.from_bytes(data=img_bytes, mime_type=img_mime or 'image/jpeg'),
                    prompt,
                ]
            else:
                contents = prompt
            resp = client.models.generate_content(model=model, contents=contents)
            return resp.text.strip(), model
        except Exception as e:
            last_err = e
            continue
    raise last_err


def _gemini_chat(client, system_prompt, history, message):
    """Chat chaqiruvi — modellar bo'ylab sinab."""
    from google.genai import types as gt
    last_err = None
    for model in GEMINI_MODELS_PRIORITY:
        try:
            chat_history = [
                gt.Content(role='user' if h['role'] == 'user' else 'model',
                           parts=[gt.Part(text=h['text'])])
                for h in history
            ]
            chat = client.chats.create(
                model=model,
                config=gt.GenerateContentConfig(system_instruction=system_prompt),
                history=chat_history,
            )
            resp = chat.send_message(message)
            return resp.text.strip(), model
        except Exception as e:
            last_err = e
            continue
    raise last_err


class AiExplainView(APIView):
    """
    15. AI orqali qarindoshlik munosabatini tushuntiradi.
    Gemini 2.0 Flash (bepul) yoki template fallback.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        d = request.data
        name_a         = d.get('name_a', 'Shaxs A')
        name_b         = d.get('name_b', 'Shaxs B')
        relation_label = d.get('relation_label', '')
        lca_name       = d.get('lca_name', '')
        depth_a        = int(d.get('depth_a', 0))
        depth_b        = int(d.get('depth_b', 0))
        path_names     = d.get('path_names', [])

        api_key = getattr(settings, 'GEMINI_API_KEY', '')

        gemini_key = getattr(settings, 'GEMINI_API_KEY', '')
        groq_key   = getattr(settings, 'GROQ_API_KEY', '')
        if gemini_key or groq_key:
            try:
                chain_str = ' → '.join(path_names) if path_names else '—'
                prompt = (
                    f"O'zbek tilida 2-3 ta qisqa, do'stona gap yoz (emoji ishlatma):\n"
                    f"Ikki shaxs: {name_a} va {name_b}.\n"
                    f"Munosabat: {relation_label}.\n"
                    f"Umumiy ajdod: {lca_name or 'mavjud emas'}.\n"
                    f"{name_a} ajdodgacha: {depth_a} pog'ona, {name_b} ajdodgacha: {depth_b} pog'ona.\n"
                    f"Oila zanjiri: {chain_str}.\n"
                    f"Oddiy, tushunarli tarzda tushuntir. Faqat asosiy ma'lumot."
                )
                text, used_model = _ai_call(prompt)
                return Response({'text': text, 'source': used_model})
            except Exception:
                pass  # template ga tushadi

        text = _rel_template(name_a, name_b, relation_label, lca_name, depth_a, depth_b, path_names)
        return Response({'text': text, 'source': 'template'})


# ── 16. OCR — hujjatdan ma'lumot o'qish ───────────────────────────

class OcrView(APIView):
    """
    16. Rasm/hujjatdan shaxs ma'lumotlarini OCR orqali oladi.
    Gemini 2.0 Flash Vision (bepul, multimodal).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        img = request.FILES.get('image')
        if not img:
            return Response({'error': 'Rasm yuklanmadi'}, status=400)

        api_key = getattr(settings, 'GEMINI_API_KEY', '')
        if not api_key:
            return Response({
                'error': 'OCR uchun GEMINI_API_KEY kerak.',
                'source': 'no_api',
            }, status=503)

        try:
            import re, json
            client    = _gemini_client()
            img_bytes = img.read()
            mime_type = img.content_type or 'image/jpeg'

            prompt = (
                "Bu hujjat/rasmdan quyidagi ma'lumotlarni JSON formatida chiqar:\n"
                "- full_name: to'liq ism-familiya-otasining ismi (O'zbekcha yoki Ruscha)\n"
                "- birth_date: tug'ilgan sana YYYY-MM-DD formatida (topa olmasang null)\n"
                "- birth_place: tug'ilgan joy — shahar yoki viloyat (topa olmasang null)\n"
                "- gender: 'male' yoki 'female' (topa olmasang null)\n"
                "- notes: boshqa foydali ma'lumotlar (ixtiyoriy)\n\n"
                "MUHIM: Faqat JSON qaytardir, boshqa hech narsa yozma.\n"
                "Misol: {\"full_name\": \"Karimov Ali Vohidovich\", \"birth_date\": \"1990-05-20\", "
                "\"birth_place\": \"Toshkent shahri\", \"gender\": \"male\", \"notes\": \"\"}"
            )

            raw, used_model = _gemini_call(client, prompt, img_bytes=img_bytes, img_mime=mime_type)

            m = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw, re.DOTALL)
            if not m:
                m = re.search(r'\{.*\}', raw, re.DOTALL)
            if m:
                json_str = m.group(1) if m.lastindex else m.group()
                data = json.loads(json_str)
                return Response({'data': data, 'source': f'gemini/{used_model}'})

            return Response({'error': 'AI javob tushunarsiz', 'raw': raw}, status=422)

        except Exception as e:
            err_str = str(e)
            if '429' in err_str or 'RESOURCE_EXHAUSTED' in err_str:
                return Response({
                    'error': "Gemini API kvotasi tugagan. Yangi kalit oling: https://aistudio.google.com/apikey",
                    'source': 'quota_exceeded',
                }, status=429)
            if '403' in err_str or 'PERMISSION_DENIED' in err_str:
                return Response({
                    'error': "API kaliti noto'g'ri yoki ruxsat yo'q. https://aistudio.google.com/apikey dan yangi kalit oling.",
                    'source': 'auth_error',
                }, status=403)
            return Response({'error': f'AI xatosi: {err_str[:200]}'}, status=500)


# ── AI Chat ─────────────────────────────────────────────────────────

class AiChatView(APIView):
    """
    Global AI chat yordamchisi.
    Ilovaning barcha bo'limlarida yordam beradi.
    """
    permission_classes = [IsAuthenticated]

    def _find_person_in_db(self, user, message):
        """Xabarda eslatilgan shaxsni DB dan topib, haqiqiy ma'lumotlarini qaytaradi."""
        from .models import Person
        msg_lower = message.lower()
        persons = Person.objects.filter(created_by=user)
        best = None
        best_score = 0
        for p in persons:
            name_parts = p.full_name.lower().split()
            score = sum(1 for part in name_parts if len(part) > 2 and part in msg_lower)
            if score > best_score:
                best_score = score
                best = p
        if best_score >= 2:
            return best
        return None

    def post(self, request):
        message      = request.data.get('message', '').strip()
        history      = request.data.get('history', [])
        ctx          = request.data.get('context', {})
        if not message:
            return Response({'error': 'Xabar bo\'sh'}, status=400)

        user         = request.user
        user_name    = user.get_full_name() or user.username
        total        = ctx.get('total_persons', 0)
        current_page = ctx.get('page', '')
        persons_list = ctx.get('persons', [])

        # Shaxslar ro'yxatini matn shaklida (faqat ism + yil)
        if persons_list:
            plist_str = ', '.join(
                f"{p['name']} ({p.get('birth_year') or '?'})"
                for p in persons_list[:40]
            )
        else:
            plist_str = "Ma'lumot yuborilmagan."

        # Xabarda shaxs eslatilsa — DB dan to'g'ridan javob qaytarish (AI ga ishonmasdan)
        found_person = self._find_person_in_db(user, message)
        is_person_query = any(w in message.lower() for w in [
            'haqida', 'kim', 'ma\'lumot', 'tug\'ilgan', 'yoshi', 'qayer'
        ])
        if found_person and is_person_query:
            p = found_person
            lines = [f"👤 **{p.full_name}** haqida ma'lumot:"]
            lines.append(f"• Tug'ilgan sana: {p.birth_date if p.birth_date else 'kiritilmagan'}")
            if p.birth_place:
                lines.append(f"• Tug'ilgan joy: {p.birth_place}")
            lines.append(f"• Jins: {'Erkak 👨' if p.gender == 'male' else 'Ayol 👩' if p.gender == 'female' else 'kiritilmagan'}")
            if p.death_date:
                lines.append(f"• Vafot sanasi: {p.death_date}")
            if p.phone:
                lines.append(f"• Telefon: {p.phone}")
            lines.append(f"\n💡 Qarindoshlik ma'lumoti uchun /relationship sahifasiga o'ting.")
            return Response({'text': '\n'.join(lines), 'source': 'db_direct'})

        person_data_str = ''
        if found_person:
            p = found_person
            fields = [f"Ismi: {p.full_name}"]
            if p.birth_date: fields.append(f"Tug'ilgan sana: {p.birth_date}")
            if p.birth_place: fields.append(f"Tug'ilgan joy: {p.birth_place}")
            if p.gender: fields.append(f"Jins: {'Erkak' if p.gender == 'male' else 'Ayol'}")
            person_data_str = "\n\nDB MA'LUMOTI:\n" + "\n".join(fields)
            person_data_str += "\nOTA/ONA/FARZAND MA'LUMOTI YO'Q — bu haqda hech narsa yozma."

        system_prompt = f"""Sen "Shajara" oila daraxti ilovasining AI yordamchisisisan.

FOYDALANUVCHI: {user_name}
JORIY SAHIFA: {current_page}
OILADAGI JAMI A'ZOLAR: {total} ta

ILOVA BO'LIMLARI:
🌲 /tree — Vizual oila daraxti (drag-drop, PNG eksport, ulashish)
👥 /persons — Barcha a'zolar ro'yxati
➕ /persons/add — Yangi shaxs qo'shish (OCR ham bor)
📊 /statistics — Tahlil va grafiklar
🔗 /relationship — Ikki shaxs orasidagi qarindoshlikni hisoblash
👤 /my-profile — O'z profilingni bog'lash
🔔 /notifications — Tug'ilgan kun eslatmalari

OILADAGI A'ZOLAR RO'YXATI (faqat ism va yil):
{plist_str}{person_data_str}

QATIY QOIDALAR:
1. O'zbekcha javob ber, qisqa va aniq (2-4 gap)
2. Shaxs haqida SO'RALGANDA: FAQAT yuqoridagi "DB DAN HAQIQIY MA'LUMOT" bo'limini ishlat
3. Ota, ona, aka, uka, farzand, qarindosh munosabatlarini HECH QACHON o'zingdan TO'QIMA
4. "Avozi", "Rashidi", "Shuxrati" kabi NOTO'G'RI so'zlar ishlatma
5. Qarindoshlik bilmoqchi bo'lsa: "/relationship sahifasiga o'ting" de
6. Bazada yo'q ma'lumotni ixtiro qilma — "bu ma'lumot bazada yo'q" de"""

        try:
            text, used_model = _ai_chat(system_prompt, history[-12:], message)
            return Response({'text': text, 'source': used_model})

        except Exception as e:
            err_str = str(e)
            if '429' in err_str or 'RESOURCE_EXHAUSTED' in err_str:
                return Response({
                    'text': "⚠️ AI kvotasi tugagan.\n\nGroq bepul kaliti oling: https://console.groq.com/keys\nKeyin backend/.env ga GROQ_API_KEY=gsk_... qo'shing va serverni restart qiling.",
                    'source': 'quota_error',
                })
            return Response({
                'text': f"⚠️ Xato: {err_str[:200]}",
                'source': 'server_error',
            })


# ── AI Status (kalit holati) ─────────────────────────────────────

class AiStatusView(APIView):
    """API kalitning holati va ishlayotgan modelni tekshiradi."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        api_key = getattr(settings, 'GEMINI_API_KEY', '')
        if not api_key:
            return Response({'status': 'no_key', 'message': 'GEMINI_API_KEY sozlanmagan.'})

        try:
            client    = _gemini_client()
            text, mdl = _gemini_call(client, 'Salom! Qisqa test.')
            return Response({
                'status':  'ok',
                'model':   mdl,
                'message': f"✅ AI ishlaydi! Model: {mdl}",
                'sample':  text[:60],
            })
        except Exception as e:
            err = str(e)
            if '429' in err or 'RESOURCE_EXHAUSTED' in err:
                return Response({
                    'status':  'quota_exceeded',
                    'message': "⚠️ Kvota tugagan. Yangi kalit kerak: https://aistudio.google.com/apikey",
                })
            if '403' in err or 'PERMISSION_DENIED' in err:
                return Response({
                    'status':  'invalid_key',
                    'message': "❌ API kalit noto'g'ri yoki ruxsat yo'q.",
                })
            return Response({'status': 'error', 'message': err[:150]})
