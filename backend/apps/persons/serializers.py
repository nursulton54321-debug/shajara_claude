from rest_framework import serializers
from .models import Person, Reminder, Family, AuditLog, Invite


# ── Yordamchi: rasm URL ──────────────────────────────────────────
def _photo_url(person, request):
    if not person:
        return None
    # ImageKit CDN URL — har doim ustuvor
    if getattr(person, 'photo_url', ''):
        return person.photo_url
    # Lokal fayl — faqat disk da mavjud bo'lsa
    if person.photo and request:
        try:
            import os
            if os.path.exists(person.photo.path):
                return request.build_absolute_uri(person.photo.url)
        except Exception:
            pass
    return None


# ── Family serializer ────────────────────────────────────────────
class FamilySerializer(serializers.ModelSerializer):
    husband_name   = serializers.CharField(source='husband.full_name', read_only=True)
    wife_name      = serializers.CharField(source='wife.full_name',    read_only=True)
    husband_photo  = serializers.SerializerMethodField()
    wife_photo     = serializers.SerializerMethodField()
    husband_gender = serializers.CharField(source='husband.gender',    read_only=True)
    wife_gender    = serializers.CharField(source='wife.gender',       read_only=True)
    is_divorced    = serializers.ReadOnlyField()
    children_count = serializers.SerializerMethodField()

    class Meta:
        model  = Family
        fields = [
            'id', 'husband', 'husband_name', 'husband_photo', 'husband_gender',
            'wife',    'wife_name',    'wife_photo',    'wife_gender',
            'wedding_date', 'divorce_date', 'order', 'note',
            'is_active', 'is_divorced', 'children_count', 'created_at',
        ]
        read_only_fields = ['created_by', 'created_at']

    def get_husband_photo(self, obj):
        return _photo_url(obj.husband, self.context.get('request'))

    def get_wife_photo(self, obj):
        return _photo_url(obj.wife, self.context.get('request'))

    def get_children_count(self, obj):
        return obj.children.count()

    def validate(self, data):
        husband = data.get('husband') or getattr(self.instance, 'husband', None)
        wife    = data.get('wife')    or getattr(self.instance, 'wife', None)
        if husband and wife and husband.id == wife.id:
            raise serializers.ValidationError("Er va xotin bir xil shaxs bo'lishi mumkin emas.")
        # Takror nikoh tekshiruvi (bir juft uchun)
        if husband and wife:
            qs = Family.objects.filter(husband=husband, wife=wife)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("Bu juft uchun oila yozuvi allaqachon mavjud.")
        return data


# ── PersonShortSerializer ────────────────────────────────────────
class PersonShortSerializer(serializers.ModelSerializer):
    full_name    = serializers.ReadOnlyField()
    age          = serializers.ReadOnlyField()
    age_would_be = serializers.ReadOnlyField()
    photo_url    = serializers.SerializerMethodField()
    families     = serializers.SerializerMethodField()

    class Meta:
        model  = Person
        fields = ['id', 'full_name', 'gender', 'birth_date', 'death_date',
                  'age', 'age_would_be', 'photo', 'photo_url', 'child_number',
                  'father_id', 'mother_id', 'birth_place', 'phone', 'families']

    def get_photo_url(self, obj):
        return _photo_url(obj, self.context.get('request'))

    def get_families(self, obj):
        from django.db.models import Q
        fams = Family.objects.filter(Q(husband=obj) | Q(wife=obj), is_active=True)
        result = []
        for f in fams:
            is_husband = f.husband_id == obj.id
            partner = f.wife if is_husband else f.husband
            result.append({
                'id': f.id,
                'partner_id':    partner.id,
                'partner_name':  partner.full_name,
                'partner_gender': partner.gender,
                'wedding_date':  str(f.wedding_date) if f.wedding_date else None,
                'is_divorced':   f.is_divorced,
            })
        return result


# ── PersonSerializer (detail) ────────────────────────────────────
class PersonSerializer(serializers.ModelSerializer):
    full_name       = serializers.ReadOnlyField()
    age             = serializers.ReadOnlyField()
    age_would_be    = serializers.ReadOnlyField()
    is_deceased     = serializers.ReadOnlyField()
    created_by_name = serializers.SerializerMethodField()
    father_name     = serializers.CharField(source='father.full_name', read_only=True)
    mother_name     = serializers.CharField(source='mother.full_name', read_only=True)
    father_photo    = serializers.SerializerMethodField()
    mother_photo    = serializers.SerializerMethodField()
    photo_url       = serializers.SerializerMethodField()
    age_at_death    = serializers.SerializerMethodField()
    children        = serializers.SerializerMethodField()
    reminders       = serializers.SerializerMethodField()
    families        = serializers.SerializerMethodField()

    # Backward-compat: birinchi oilaning turmush o'rtog'i
    spouse_name      = serializers.SerializerMethodField()
    spouse_photo     = serializers.SerializerMethodField()
    first_spouse_id  = serializers.SerializerMethodField()   # partner id (birinchi oila)

    class Meta:
        model  = Person
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        return super().create(validated_data)

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)

    # ── helpers ──────────────────────────────────────────────────
    def _first_partner(self, obj):
        """Birinchi aktiv oilaning turmush o'rtog'i."""
        from django.db.models import Q
        fam = Family.objects.filter(
            Q(husband=obj) | Q(wife=obj),
            is_active=True
        ).order_by('order', 'wedding_date').first()
        if not fam:
            return None
        return fam.wife if fam.husband_id == obj.id else fam.husband

    # ── SerializerMethodField getters ────────────────────────────
    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_father_photo(self, obj):
        return _photo_url(obj.father, self.context.get('request'))

    def get_mother_photo(self, obj):
        return _photo_url(obj.mother, self.context.get('request'))

    def get_photo_url(self, obj):
        return _photo_url(obj, self.context.get('request'))

    def get_age_at_death(self, obj):
        if obj.birth_date and obj.death_date:
            return (obj.death_date - obj.birth_date).days // 365
        return None

    def get_spouse_name(self, obj):
        p = self._first_partner(obj)
        return p.full_name if p else None

    def get_spouse_photo(self, obj):
        p = self._first_partner(obj)
        return _photo_url(p, self.context.get('request'))

    def get_first_spouse_id(self, obj):
        p = self._first_partner(obj)
        return p.id if p else None

    def get_families(self, obj):
        """Ushbu shaxsga tegishli barcha oilalar (er yoki xotin sifatida)."""
        from django.db.models import Q
        request = self.context.get('request')
        fams = Family.objects.filter(
            Q(husband=obj) | Q(wife=obj)
        ).select_related('husband', 'wife').order_by('order', 'wedding_date')
        result = []
        for f in fams:
            is_husband = f.husband_id == obj.id
            partner    = f.wife if is_husband else f.husband
            result.append({
                'id':             f.id,
                'order':          f.order,
                'is_husband':     is_husband,
                'partner_id':     partner.id,
                'partner_name':   partner.full_name,
                'partner_gender': partner.gender,
                'partner_photo':  _photo_url(partner, request),
                'wedding_date':   str(f.wedding_date)  if f.wedding_date  else None,
                'divorce_date':   str(f.divorce_date)  if f.divorce_date  else None,
                'is_divorced':    f.is_divorced,
                'is_active':      f.is_active,
                'note':           f.note,
                'children_count': f.children.count(),
            })
        return result

    def get_children(self, obj):
        children = list(
            Person.objects.filter(father=obj) | Person.objects.filter(mother=obj)
        )
        seen, result = set(), []
        request = self.context.get('request')
        for c in children:
            if c.id not in seen:
                seen.add(c.id)
                result.append({
                    'id':           c.id,
                    'full_name':    c.full_name,
                    'gender':       c.gender,
                    'birth_date':   str(c.birth_date)  if c.birth_date  else None,
                    'death_date':   str(c.death_date)  if c.death_date  else None,
                    'child_number': c.child_number,
                    'photo_url':    _photo_url(c, request),
                    'mother_id':    c.mother_id,
                    'father_id':    c.father_id,
                })
        result.sort(key=lambda x: x['child_number'] or 99)
        return result

    def get_reminders(self, obj):
        qs = obj.reminders.filter(is_active=True).order_by('date')
        return [{
            'id':           r.id,
            'type':         r.type,
            'type_display': r.get_type_display(),
            'icon':         r.icon,
            'color':        r.color,
            'date':         str(r.date) if r.date else None,
            'note':         r.note,
        } for r in qs]


# ── PersonTreeSerializer (lightweight for tree view) ─────────────
class PersonTreeSerializer(serializers.ModelSerializer):
    full_name   = serializers.ReadOnlyField()
    is_deceased = serializers.ReadOnlyField()
    photo_url   = serializers.SerializerMethodField()
    families    = serializers.SerializerMethodField()

    class Meta:
        model  = Person
        fields = ['id', 'full_name', 'gender', 'birth_date', 'death_date',
                  'is_deceased', 'photo_url', 'father_id', 'mother_id',
                  'child_number', 'families']

    def get_photo_url(self, obj):
        return _photo_url(obj, self.context.get('request'))

    def get_families(self, obj):
        """Tree uchun: faqat partner_id va asosiy ma'lumotlar."""
        from django.db.models import Q
        fams = Family.objects.filter(
            Q(husband=obj) | Q(wife=obj), is_active=True
        ).values('id', 'husband_id', 'wife_id', 'wedding_date', 'divorce_date', 'order')
        result = []
        for f in fams:
            is_husband = f['husband_id'] == obj.id
            partner_id = f['wife_id'] if is_husband else f['husband_id']
            result.append({
                'family_id':    f['id'],
                'partner_id':   partner_id,
                'wedding_date': str(f['wedding_date']) if f['wedding_date'] else None,
                'order':        f['order'],
            })
        return result


# ── ReminderSerializer ───────────────────────────────────────────
class ReminderSerializer(serializers.ModelSerializer):
    person_name   = serializers.CharField(source='person.full_name', read_only=True)
    person_photo  = serializers.SerializerMethodField()
    person_gender = serializers.CharField(source='person.gender',    read_only=True)
    type_display  = serializers.CharField(source='get_type_display', read_only=True)
    icon          = serializers.ReadOnlyField()
    days_until    = serializers.ReadOnlyField()

    class Meta:
        model  = Reminder
        fields = ['id', 'person', 'person_name', 'person_photo', 'person_gender',
                  'type', 'type_display', 'icon', 'date', 'note',
                  'is_active', 'days_until', 'created_at']
        read_only_fields = ['created_by', 'created_at']

    def get_person_photo(self, obj):
        return _photo_url(obj.person, self.context.get('request'))


# ── AuditLogSerializer ───────────────────────────────────────────
class AuditLogSerializer(serializers.ModelSerializer):
    user_name      = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model  = AuditLog
        fields = [
            'id', 'user', 'user_name', 'action', 'action_display',
            'model_name', 'object_id', 'object_repr',
            'changes', 'ip_address', 'timestamp',
        ]

    def get_user_name(self, obj):
        if not obj.user:
            return 'Tizim'
        return obj.user.get_full_name() or obj.user.username


# ── InviteSerializer ─────────────────────────────────────────────
class InviteSerializer(serializers.ModelSerializer):
    person_name    = serializers.CharField(source='person.full_name', read_only=True, default=None)
    created_by_name= serializers.SerializerMethodField()
    used_by_name   = serializers.SerializerMethodField()
    is_valid       = serializers.ReadOnlyField()
    is_expired     = serializers.ReadOnlyField()
    invite_url     = serializers.SerializerMethodField()

    class Meta:
        model  = Invite
        fields = ['id', 'token', 'person', 'person_name', 'note',
                  'created_by', 'created_by_name', 'used', 'used_by',
                  'used_by_name', 'is_valid', 'is_expired',
                  'invite_url', 'created_at', 'expires_at']
        read_only_fields = ['token', 'created_by', 'created_at', 'used', 'used_by']

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return '—'
        return obj.created_by.get_full_name() or obj.created_by.username

    def get_used_by_name(self, obj):
        if not obj.used_by:
            return None
        return obj.used_by.get_full_name() or obj.used_by.username

    def get_invite_url(self, obj):
        request = self.context.get('request')
        base = request.build_absolute_uri('/') if request else 'http://localhost:5173/'
        # Frontend URL: /invite/<token>
        return f"{base.rstrip('/')}/#/invite/{obj.token}"


# ── PublicPersonSerializer ───────────────────────────────────────
class PublicPersonSerializer(serializers.ModelSerializer):
    """Autentifikatsiyasiz ko'riladigan minimal profil."""
    full_name   = serializers.ReadOnlyField()
    age         = serializers.ReadOnlyField()
    is_deceased = serializers.ReadOnlyField()
    photo_url   = serializers.SerializerMethodField()
    relatives   = serializers.SerializerMethodField()

    class Meta:
        model  = Person
        fields = ['id', 'full_name', 'gender', 'birth_date', 'death_date',
                  'birth_place', 'age', 'is_deceased', 'photo_url',
                  'slug', 'relatives']

    def get_photo_url(self, obj):
        return _photo_url(obj, self.context.get('request'))

    def get_relatives(self, obj):
        request = self.context.get('request')
        result = []
        if obj.father:
            result.append({'role': 'Otasi',  'id': obj.father.pk, 'name': obj.father.full_name,
                           'slug': obj.father.slug, 'photo': _photo_url(obj.father, request),
                           'gender': obj.father.gender})
        if obj.mother:
            result.append({'role': 'Onasi',  'id': obj.mother.pk, 'name': obj.mother.full_name,
                           'slug': obj.mother.slug, 'photo': _photo_url(obj.mother, request),
                           'gender': obj.mother.gender})
        from django.db.models import Q
        for p in Person.objects.filter(Q(father=obj) | Q(mother=obj))[:10]:
            result.append({'role': 'Farzand', 'id': p.pk, 'name': p.full_name,
                           'slug': p.slug, 'photo': _photo_url(p, request),
                           'gender': p.gender})
        from .models import Family
        for fam in Family.objects.filter(Q(husband=obj) | Q(wife=obj), is_active=True)[:5]:
            partner = fam.wife if fam.husband_id == obj.pk else fam.husband
            result.append({'role': "Turmush o'rtog'i", 'id': partner.pk, 'name': partner.full_name,
                           'slug': partner.slug, 'photo': _photo_url(partner, request),
                           'gender': partner.gender})
        return result
