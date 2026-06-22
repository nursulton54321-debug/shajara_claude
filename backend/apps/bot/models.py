import secrets
from django.db import models
from django.utils import timezone
from apps.users.models import User


class TelegramUser(models.Model):
    """Telegram orqali ro'yxatdan o'tgan foydalanuvchi."""
    STATUS_PENDING  = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES  = [
        (STATUS_PENDING,  'Kutilmoqda'),
        (STATUS_APPROVED, 'Tasdiqlangan'),
        (STATUS_REJECTED, 'Rad etilgan'),
    ]

    telegram_id   = models.BigIntegerField(unique=True, verbose_name='Telegram ID')
    telegram_name = models.CharField(max_length=200, blank=True, verbose_name='Telegram ismi')
    full_name     = models.CharField(max_length=200, blank=True, verbose_name='Kiritilgan ism')
    user          = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='telegram_profile', verbose_name='Django foydalanuvchi'
    )
    status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    awaiting_invite_token = models.CharField(max_length=64, blank=True, default='')
    invited_by    = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='invited_users', verbose_name='Kim taklif qildi'
    )
    approved_by   = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approvals', verbose_name='Kim tasdiqladi'
    )
    approved_at   = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = 'Telegram foydalanuvchi'
        verbose_name_plural = 'Telegram foydalanuvchilar'
        ordering            = ['-created_at']

    def __str__(self):
        return f"{self.full_name or self.telegram_name} ({self.telegram_id})"

    @property
    def is_approved(self):
        return self.status == self.STATUS_APPROVED

    @property
    def is_admin(self):
        return self.user and (self.user.is_superuser or self.user.role == 'admin')

    @property
    def role_label(self):
        if self.user and self.user.is_superuser:
            return 'superadmin'
        if self.user and self.user.role == 'admin':
            return 'admin'
        return 'user'

    def approve(self, approved_by=None):
        """Foydalanuvchini tasdiqlash va Django User yaratish (sync)."""
        if self.status == self.STATUS_APPROVED:
            return
        username = f'tg_{self.telegram_id}'
        if not self.user:
            user, _ = User.objects.get_or_create(
                username=username,
                defaults={'first_name': self.full_name, 'role': 'user'},
            )
            self.user = user
        self.status      = self.STATUS_APPROVED
        self.approved_by = approved_by
        self.approved_at = timezone.now()
        self.save()

    async def aapprove(self, approved_by=None):
        """Async versiya."""
        if self.status == self.STATUS_APPROVED:
            return
        username = f'tg_{self.telegram_id}'
        if not self.user:
            user, _ = await User.objects.aget_or_create(
                username=username,
                defaults={'first_name': self.full_name, 'role': 'user'},
            )
            self.user = user
        self.status      = self.STATUS_APPROVED
        self.approved_by = approved_by
        self.approved_at = timezone.now()
        await self.asave()

    def reject(self):
        self.status = self.STATUS_REJECTED
        self.save()

    async def areject(self):
        self.status = self.STATUS_REJECTED
        await self.asave()


class BotInvite(models.Model):
    """Bir martalik invite link."""
    token      = models.CharField(max_length=64, unique=True, default=secrets.token_urlsafe)
    created_by = models.ForeignKey(
        TelegramUser, on_delete=models.CASCADE, related_name='created_invites'
    )
    expires_at = models.DateTimeField()
    used_by    = models.ForeignKey(
        TelegramUser, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='used_invite'
    )
    is_used    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = 'Bot invite'
        verbose_name_plural = 'Bot invitelar'
        ordering            = ['-created_at']

    def __str__(self):
        return f"Invite {self.token[:12]}... ({self.created_by})"

    @property
    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at

    @classmethod
    def create_for(cls, tg_user, days=7):
        expires = timezone.now() + timezone.timedelta(days=days)
        return cls.objects.create(created_by=tg_user, expires_at=expires)
