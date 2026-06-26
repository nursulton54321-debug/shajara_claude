from ._base import *
from django.db import models as django_models


# ── Audit Log ────────────────────────────────────────────────────

class AuditLogListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = AuditLog.objects.select_related('user').all()
        action     = request.query_params.get('action')
        model_name = request.query_params.get('model')
        user_id    = request.query_params.get('user')
        date_from  = request.query_params.get('date_from')
        date_to    = request.query_params.get('date_to')
        search     = request.query_params.get('search')

        if action:     qs = qs.filter(action=action)
        if model_name: qs = qs.filter(model_name__iexact=model_name)
        if user_id:    qs = qs.filter(user_id=user_id)
        if date_from:  qs = qs.filter(timestamp__date__gte=date_from)
        if date_to:    qs = qs.filter(timestamp__date__lte=date_to)
        if search:
            qs = qs.filter(
                Q(object_repr__icontains=search) |
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(user__username__icontains=search)
            )

        page_size = int(request.query_params.get('page_size', 50))
        page      = int(request.query_params.get('page', 1))
        total     = qs.count()
        start     = (page - 1) * page_size
        qs        = qs[start: start + page_size]
        data = AuditLogSerializer(qs, many=True).data
        return Response({'count': total, 'page': page,
                         'pages': (total + page_size - 1) // page_size, 'results': data})


# ── Did You Know ─────────────────────────────────────────────────

class DidYouKnowView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import random
        from django.db.models import Count
        from collections import Counter
        facts = []
        persons = list(Person.objects.all())
        if not persons:
            return Response({'fact': 'Hali shaxslar kiritilmagan.', 'icon': '🌱'})

        today = timezone.now().date()
        alive_with_birth = [p for p in persons if p.birth_date and not p.death_date]

        if alive_with_birth:
            oldest = max(alive_with_birth, key=lambda p: (today - p.birth_date).days)
            age = (today - oldest.birth_date).days // 365
            facts.append({'icon': '👴', 'fact': f"Eng katta yoshli a'zo — {oldest.full_name}, u {age} yoshda!", 'person_id': oldest.id})

        deceased = [p for p in persons if p.birth_date and p.death_date]
        if deceased:
            longest = max(deceased, key=lambda p: (p.death_date - p.birth_date).days)
            age = (longest.death_date - longest.birth_date).days // 365
            facts.append({'icon': '🕯️', 'fact': f"{longest.full_name} eng uzun umr ko'rgan — {age} yoshda vafot etgan.", 'person_id': longest.id})

        top_parent = (Person.objects
            .annotate(ch=Count('children_as_father') + Count('children_as_mother'))
            .order_by('-ch').first())
        if top_parent and top_parent.ch > 0:
            facts.append({'icon': '👨‍👩‍👧‍👦', 'fact': f"{top_parent.full_name} — eng ko'p farzandli: {top_parent.ch} nafar.", 'person_id': top_parent.id})

        today_bd = [p for p in persons if p.birth_date and p.birth_date.month == today.month and p.birth_date.day == today.day]
        if today_bd:
            p = random.choice(today_bd)
            age = today.year - p.birth_date.year
            facts.append({'icon': '🎂', 'fact': f"Bugun {p.full_name}ning tug'ilgan kuni! Unga {age} yosh to'ldi.", 'person_id': p.id})

        total = len(persons)
        alive = sum(1 for p in persons if not p.death_date)
        facts.append({'icon': '🌳', 'fact': f"Shajarangizda jami {total} ta shaxs, shulardan {alive} tasi hozir hayot."})

        if alive_with_birth:
            youngest = min(alive_with_birth, key=lambda p: p.birth_date)
            age = (today - youngest.birth_date).days // 365
            if age < 18:
                facts.append({'icon': '👶', 'fact': f"Eng yosh a'zo — {youngest.full_name}, {age} yoshda.", 'person_id': youngest.id})

        birth_years = Counter(p.birth_date.year for p in persons if p.birth_date)
        if birth_years:
            top_year, top_count = birth_years.most_common(1)[0]
            if top_count > 1:
                facts.append({'icon': '📅', 'fact': f"{top_year} yilda eng ko'p shaxs tug'ilgan — {top_count} nafar."})

        names = Counter(p.first_name for p in persons if p.first_name)
        if names:
            top_name, top_cnt = names.most_common(1)[0]
            if top_cnt > 1:
                facts.append({'icon': '📛', 'fact': f"Eng ko'p uchraydigan ism — '{top_name}': {top_cnt} nafar."})

        chosen = random.choice(facts) if facts else {'icon': '🌿', 'fact': 'Shajarangiz kengayib bormoqda!'}
        return Response(chosen)


# ── Invite ───────────────────────────────────────────────────────

class InviteListCreateView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = Invite.objects.select_related('person', 'created_by', 'used_by').all()
        return Response(InviteSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        person_id = request.data.get('person')
        note      = request.data.get('note', '')
        days      = request.data.get('expires_days')
        person = None
        if person_id:
            try:
                person = Person.objects.get(pk=person_id)
            except Person.DoesNotExist:
                return Response({'error': 'Shaxs topilmadi'}, status=400)
        expires_at = None
        if days:
            expires_at = timezone.now() + timezone.timedelta(days=int(days))
        invite = Invite.objects.create(person=person, note=note, created_by=request.user, expires_at=expires_at)
        return Response(InviteSerializer(invite, context={'request': request}).data, status=201)


class InviteDetailView(APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, pk):
        try:
            Invite.objects.get(pk=pk, created_by=request.user).delete()
        except Invite.DoesNotExist:
            pass
        return Response(status=204)


class InviteTokenView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            invite = Invite.objects.select_related('person').get(token=token)
        except Invite.DoesNotExist:
            return Response({'error': 'Invite topilmadi'}, status=404)
        if not invite.is_valid:
            return Response({'error': "Invite muddati o'tgan yoki ishlatilgan"}, status=400)
        return Response({
            'token':       str(invite.token),
            'note':        invite.note,
            'person_name': invite.person.full_name if invite.person else None,
            'person_id':   invite.person.pk        if invite.person else None,
            'expires_at':  invite.expires_at,
        })


# ── My Profile ───────────────────────────────────────────────────

class MyProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            person = request.user.linked_person
            return Response(PersonSerializer(person, context={'request': request}).data)
        except Exception:
            return Response(None)

    def post(self, request):
        person_id = request.data.get('person_id')
        if not person_id:
            Person.objects.filter(linked_user=request.user).update(linked_user=None)
            return Response({'detail': "Bog'liqlik uzildi"})
        try:
            person = Person.objects.get(pk=person_id)
        except Person.DoesNotExist:
            return Response({'error': 'Shaxs topilmadi'}, status=404)
        Person.objects.filter(linked_user=request.user).update(linked_user=None)
        person.linked_user = request.user
        person.save(update_fields=['linked_user'])
        return Response(PersonSerializer(person, context={'request': request}).data)


# ── Public Profile ────────────────────────────────────────────────

class PublicPersonView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        try:
            person = Person.objects.get(slug=slug)
        except Person.DoesNotExist:
            return Response({'error': 'Shaxs topilmadi'}, status=404)
        return Response(PublicPersonSerializer(person, context={'request': request}).data)


# ── Share Link ────────────────────────────────────────────────────

class ShareLinkListCreateView(APIView):
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
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            lnk = ShareLink.objects.select_related('created_by').get(token=token)
        except ShareLink.DoesNotExist:
            return Response({'error': 'Havola topilmadi'}, status=404)

        if not lnk.is_valid:
            return Response({'error': "Havolaning muddati tugagan yoki u o'chirilgan"}, status=410)

        ShareLink.objects.filter(pk=lnk.pk).update(view_count=django_models.F('view_count') + 1)

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
