import io
import os
import uuid
from django.core.files.base import ContentFile
from django.db import models
from django.utils.text import slugify
from apps.users.models import User


class Person(models.Model):
    GENDER_CHOICES = [('male', 'Erkak'), ('female', 'Ayol')]

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    child_number = models.PositiveIntegerField(null=True, blank=True, help_text="Nechanchi farzand")

    birth_date  = models.DateField(null=True, blank=True)
    death_date  = models.DateField(null=True, blank=True)
    birth_place = models.CharField(max_length=200, blank=True, help_text="Tug'ilgan joy (viloyat, shahar)")

    photo = models.ImageField(upload_to='photos/', null=True, blank=True)
    photo_url = models.URLField(blank=True, default='')  # ImageKit CDN URL
    phone = models.CharField(max_length=20, blank=True)

    father = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children_as_father')
    mother = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='children_as_mother')

    # 4.2 — foydalanuvchi o'z profiliga bog'lanishi
    linked_user = models.OneToOneField(User, null=True, blank=True,
                                       on_delete=models.SET_NULL, related_name='linked_person')
    # 4.3 — public link slug: /p/<slug>
    slug = models.SlugField(max_length=120, unique=True, blank=True, null=True)

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='persons')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['child_number', 'birth_date']

    @property
    def full_name(self):
        return f"{self.last_name} {self.first_name} {self.middle_name}".strip()

    @property
    def age(self):
        """Vafot etgan bo'lsa — vafotdagi yosh; tirik bo'lsa — hozirgi yosh."""
        if not self.birth_date:
            return None
        from django.utils import timezone
        end = self.death_date or timezone.now().date()
        return (end - self.birth_date).days // 365

    @property
    def age_would_be(self):
        """Vafot etgan bo'lsa — hozir necha yosh bo'lar edi. Tirik bo'lsa None."""
        if not self.birth_date or not self.death_date:
            return None
        from django.utils import timezone
        today = timezone.now().date()
        return (today - self.birth_date).days // 365

    @property
    def is_deceased(self):
        return self.death_date is not None

    def _optimize_photo(self):
        """6.2 — Rasmni WebP formatiga o'tkazish va max 800×800 ga resize qilish."""
        try:
            from PIL import Image as PILImage
            img = PILImage.open(self.photo)
            img = img.convert('RGB')
            img.thumbnail((800, 800), PILImage.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format='WEBP', quality=85, method=6)
            buf.seek(0)
            # Faylni .webp kengaytmasi bilan saqlash
            old_name = os.path.basename(self.photo.name)
            new_name = os.path.splitext(old_name)[0] + '.webp'
            self.photo.save(new_name, ContentFile(buf.read()), save=False)
        except Exception:
            pass  # Optimizatsiya muvaffaqiyatsiz bo'lsa — asl rasm qoladi

    def save(self, *args, **kwargs):
        # Slug avtomatik generatsiya — bir marta
        if not self.slug:
            base = slugify(f"{self.last_name}-{self.first_name}", allow_unicode=False) or 'person'
            slug = base[:80]
            n = 1
            while Person.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base[:75]}-{n}"
                n += 1
            self.slug = slug

        # 6.2 — Yangi rasm yuklangan bo'lsa optimizatsiya qilamiz
        _old_photo = None
        if self.pk:
            try:
                _old_photo = Person.objects.get(pk=self.pk).photo
            except Person.DoesNotExist:
                pass
        super().save(*args, **kwargs)
        # Rasm o'zgargan bo'lsa — optimize qilamiz va qayta saqlaymiz
        if self.photo and (not _old_photo or self.photo.name != _old_photo.name):
            if not self.photo.name.endswith('.webp'):
                self._optimize_photo()
                # photo.name o'zgardi — faqat photo fieldni update qilamiz
                Person.objects.filter(pk=self.pk).update(photo=self.photo.name)

    def __str__(self):
        return self.full_name


class Reminder(models.Model):
    TYPE_CHOICES = [
        ('birthday',     "Tug'ilgan kun"),
        ('wedding',      "To'y / Nikoh"),
        ('school_start', "O'qishga kirish"),
        ('school_end',   "O'qishni tugatish"),
        ('work_start',   "Ishga kirish"),
        ('work_end',     "Ishdan ketish"),
        ('military',     "Harbiy xizmat"),
        ('hajj',         "Haj / Umra"),
        ('award',        "Mukofot / Unvon"),
        ('move',         "Ko'chib o'tish"),
        ('illness',      "Kasallik / Davolanish"),
        ('travel',       "Sayohat"),
        ('death',        "Vafot etgan kun"),
        ('memorial',     "Xotira kuni"),
        ('other',        "Boshqa"),
    ]

    TYPE_ICONS = {
        'birthday':    '🎂',
        'wedding':     '💍',
        'school_start':'🎒',
        'school_end':  '🎓',
        'work_start':  '💼',
        'work_end':    '🏠',
        'military':    '🎖️',
        'hajj':        '🕌',
        'award':       '🏆',
        'move':        '🏡',
        'illness':     '🏥',
        'travel':      '✈️',
        'death':       '🌿',
        'memorial':    '🕯️',
        'other':       '📌',
    }

    TYPE_COLORS = {
        'birthday':    '#10b981',
        'wedding':     '#f43f5e',
        'school_start':'#6366f1',
        'school_end':  '#8b5cf6',
        'work_start':  '#0ea5e9',
        'work_end':    '#64748b',
        'military':    '#d97706',
        'hajj':        '#059669',
        'award':       '#f59e0b',
        'move':        '#ec4899',
        'illness':     '#ef4444',
        'travel':      '#06b6d4',
        'death':       '#6b7280',
        'memorial':    '#94a3b8',
        'other':       '#a855f7',
    }

    person     = models.ForeignKey(Person, on_delete=models.CASCADE, related_name='reminders')
    type       = models.CharField(max_length=30, choices=TYPE_CHOICES)
    date       = models.DateField()
    note       = models.TextField(blank=True)
    is_active  = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date']

    @property
    def icon(self):
        return self.TYPE_ICONS.get(self.type, '📌')

    @property
    def color(self):
        return self.TYPE_COLORS.get(self.type, '#a855f7')

    @property
    def days_until(self):
        from django.utils import timezone
        today = timezone.now().date()
        # Next occurrence (this year or next)
        try:
            next_date = self.date.replace(year=today.year)
        except ValueError:
            next_date = self.date.replace(year=today.year, day=28)
        if next_date < today:
            try:
                next_date = next_date.replace(year=today.year + 1)
            except ValueError:
                next_date = next_date.replace(year=today.year + 1, day=28)
        return (next_date - today).days

    def __str__(self):
        return f"{self.person.full_name} — {self.get_type_display()} ({self.date})"


# ── Ko'p oila arxitekturasi ──────────────────────────────────────
class Family(models.Model):
    """
    Bitta er-xotin juftini ifodalaydi.
    Bir shaxs bir nechta Family yozuvida bo'lishi mumkin (ko'p nikoh).
    Farzandlar Person.father / Person.mother orqali biriktirilgan —
    father+mother juftidan qaysi Family ekanini avtomatik aniqlanadi.
    """
    husband     = models.ForeignKey(Person, on_delete=models.CASCADE,
                                    related_name='families_as_husband')
    wife        = models.ForeignKey(Person, on_delete=models.CASCADE,
                                    related_name='families_as_wife')
    wedding_date  = models.DateField(null=True, blank=True, verbose_name="To'y sanasi")
    divorce_date  = models.DateField(null=True, blank=True, verbose_name="Ajralish sanasi")
    order         = models.PositiveSmallIntegerField(default=1, help_text="Nechanchi nikoh (1,2,3…)")
    note          = models.TextField(blank=True, verbose_name="Izoh")
    is_active     = models.BooleanField(default=True)
    created_by    = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='families')
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['wedding_date', 'order']
        verbose_name = "Oila"
        verbose_name_plural = "Oilalar"

    @property
    def is_divorced(self):
        return self.divorce_date is not None

    @property
    def children(self):
        """Ushbu juftning farzandlari (father+mother orqali)."""
        return Person.objects.filter(father=self.husband, mother=self.wife)


# ── Audit Log ─────────────────────────────────────────────────────
class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('create', 'Qo\'shildi'),
        ('update', 'Yangilandi'),
        ('delete', 'O\'chirildi'),
        ('login',  'Tizimga kirdi'),
        ('export', 'Eksport qildi'),
        ('import', 'Import qildi'),
    ]

    user        = models.ForeignKey(User, on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='audit_logs')
    action      = models.CharField(max_length=20, choices=ACTION_CHOICES)
    model_name  = models.CharField(max_length=50, blank=True)   # 'Person', 'Family', ...
    object_id   = models.PositiveIntegerField(null=True, blank=True)
    object_repr = models.CharField(max_length=200, blank=True)  # "Matayev Elyor"
    changes     = models.JSONField(default=dict, blank=True)     # {field: [old, new]}
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    timestamp   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Audit Log'

    def __str__(self):
        return f"{self.user} | {self.action} | {self.model_name}:{self.object_id} | {self.timestamp:%Y-%m-%d %H:%M}"


# ── 4.1 Invite ─────────────────────────────────────────────────────
class Invite(models.Model):
    token      = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    person     = models.ForeignKey(Person, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='invites',
                                   help_text="Ushbu invite qaysi shaxs uchun")
    note       = models.CharField(max_length=200, blank=True, help_text="Kim uchun yuborildi")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invites_sent')
    used       = models.BooleanField(default=False)
    used_by    = models.ForeignKey(User, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='invite_used')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Invite'

    def __str__(self):
        target = self.person.full_name if self.person else '—'
        return f"Invite → {target} ({self.token})"

    @property
    def is_expired(self):
        if not self.expires_at:
            return False
        from django.utils import timezone
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return not self.used and not self.is_expired


# ── 12. Share Link (public tree) ──────────────────────────────────
class ShareLink(models.Model):
    """
    Vaqtinchalik umumiy havola — login talab qilmasdan shajarani ko'rish uchun.
    Token 7 kun amal qiladi (standart).
    """
    token      = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='share_links')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_active  = models.BooleanField(default=True)
    note       = models.CharField(max_length=200, blank=True)
    view_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Share Link'

    def save(self, *args, **kwargs):
        if not self.expires_at:
            from django.utils import timezone
            self.expires_at = timezone.now() + timezone.timedelta(days=7)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    @property
    def is_valid(self):
        return self.is_active and not self.is_expired

    def __str__(self):
        return f"ShareLink {self.token} ({self.created_by})"


# ── 4.4 Push Subscription ──────────────────────────────────────────
class PushSubscription(models.Model):
    user     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.TextField(unique=True)
    p256dh   = models.TextField()
    auth     = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Push Subscription'

    def __str__(self):
        return f"{self.user} — {self.endpoint[:60]}"
