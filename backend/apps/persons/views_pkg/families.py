from ._base import *


class FamilyListCreateView(generics.ListCreateAPIView):
    serializer_class   = FamilySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = Family.objects.select_related('husband', 'wife').all()
        person_id = self.request.query_params.get('person')
        if person_id:
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
                defaults={
                    'note': f"To'y kuni — {instance.wife.full_name if instance.wife else ''}",
                    'created_by': self.request.user,
                }
            )


class FamilyDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = Family.objects.select_related('husband', 'wife')
    serializer_class   = FamilySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAdmin()]
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAuthenticated()]
        return [AllowAny()]
