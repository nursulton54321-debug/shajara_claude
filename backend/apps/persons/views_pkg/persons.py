from ._base import *


def _upload_to_imagekit(instance):
    if not instance.photo:
        return
    pk = getattr(settings, 'IMAGEKIT_PRIVATE_KEY', '')
    pub = getattr(settings, 'IMAGEKIT_PUBLIC_KEY', '')
    url_ep = getattr(settings, 'IMAGEKIT_URL_ENDPOINT', '')
    if not (pk and pub and url_ep):
        return
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
            auth=(pk, ''),
            files={'file': (fname, buf.getvalue(), 'image/jpeg')},
            data={'fileName': fname, 'folder': '/shajara/photos/'},
            timeout=30,
        )
        log.info(f"[ImageKit] status={resp.status_code} body={resp.text[:200]}")
        if resp.status_code == 200:
            url = resp.json().get('url', '')
            if url:
                instance.photo_url = url
                Person.objects.filter(pk=instance.pk).update(photo_url=url)
                log.info(f"[ImageKit] OK: {url}")
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"[ImageKit] xato: {e}")


def _sync_person_reminders(person, user):
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
        log_action(self.request, 'delete', instance, changes={'repr': str(instance)})
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
        from apps.persons.services import get_statistics
        return Response(get_statistics())


class BirthdaysView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        today = timezone.now().date()
        persons = Person.objects.filter(birth_date__month=today.month, death_date__isnull=True)
        data = PersonShortSerializer(persons, many=True, context={'request': request}).data
        return Response(data)
