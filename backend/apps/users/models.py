from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import random, string

class SiteSetting(models.Model):
    """Sayt sozlamalari — yagona qator (singleton)."""
    site_pin = models.CharField(max_length=20, default='2026')

    class Meta:
        verbose_name = 'Sayt sozlamasi'

    def __str__(self):
        return 'Sayt sozlamalari'

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class OTPCode(models.Model):
    """Telegram orqali yuborilgan bir martalik kod."""
    phone      = models.CharField(max_length=30)
    code       = models.CharField(max_length=4)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used    = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def is_valid(self):
        elapsed = (timezone.now() - self.created_at).total_seconds()
        return not self.is_used and elapsed < 60

    @classmethod
    def generate(cls, phone):
        cls.objects.filter(phone=phone).delete()          # eskisini o'chir
        code = ''.join(random.choices(string.digits, k=4))
        return cls.objects.create(phone=phone, code=code)

    def __str__(self):
        return f"{self.phone} → {self.code}"


class TelegramChat(models.Model):
    """Foydalanuvchi telefon raqami → Telegram chat_id xaritalash."""
    phone      = models.CharField(max_length=30, unique=True)
    chat_id    = models.CharField(max_length=30)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Telegram Chat'

    def __str__(self):
        return f"{self.phone} → {self.chat_id}"


class User(AbstractUser):
    ROLE_CHOICES = [('admin', 'Admin'), ('user', 'Foydalanuvchi')]
    role  = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    phone = models.CharField(max_length=20, blank=True)
    # 4.1 — qaysi invite orqali ro'yxatdan o'tgan
    invite_token = models.CharField(max_length=64, blank=True)

    @property
    def is_admin(self):
        return self.role == 'admin'

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"
