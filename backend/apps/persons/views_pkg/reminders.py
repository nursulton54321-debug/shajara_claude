from ._base import *


class ReminderListCreateView(generics.ListCreateAPIView):
    serializer_class = ReminderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Reminder.objects.select_related('person').all()
        type_filter = self.request.query_params.get('type')
        month       = self.request.query_params.get('month')
        year        = self.request.query_params.get('year')
        active      = self.request.query_params.get('active')

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
    permission_classes = [IsAdmin]

    def post(self, request):
        persons = Person.objects.filter(birth_date__isnull=False)
        created = 0
        for p in persons:
            if not Reminder.objects.filter(person=p, type='birthday').exists():
                Reminder.objects.create(
                    person=p, type='birthday', date=p.birth_date,
                    note=f"{p.full_name}ning tug'ilgan kuni",
                    is_active=True, created_by=request.user
                )
                created += 1
        for p in Person.objects.filter(death_date__isnull=False):
            if not Reminder.objects.filter(person=p, type='death').exists():
                Reminder.objects.create(
                    person=p, type='death', date=p.death_date,
                    note=f"{p.full_name} vafot etgan sana",
                    is_active=True, created_by=request.user
                )
                created += 1
        return Response({'created': created, 'message': f"{created} ta eslatma yaratildi"})
