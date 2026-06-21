from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import User


def _validate_password_strength(password):
    """
    Django's built-in validators + qo'shimcha tekshiruvlar:
      - kamida 8 belgi
      - faqat raqamdan iborat bo'lmasin
      - oddiy parollar (django.contrib.auth validators)
    """
    if len(password) < 8:
        raise serializers.ValidationError(
            "Parol kamida 8 belgidan iborat bo'lishi kerak."
        )
    try:
        validate_password(password)
    except DjangoValidationError as e:
        raise serializers.ValidationError(list(e.messages))


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'password', 'role', 'phone']
        read_only_fields = ['role']

    def validate_password(self, value):
        _validate_password_strength(value)
        return value

    def validate_username(self, value):
        if len(value) < 3:
            raise serializers.ValidationError("Username kamida 3 belgidan iborat bo'lishi kerak.")
        return value

    def create(self, validated_data):
        # create_user parolni avtomatik hash qiladi (set_password ichida)
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        user = authenticate(**data)
        if not user:
            raise serializers.ValidationError("Login yoki parol xato!")
        if not user.is_active:
            raise serializers.ValidationError("Hisob o'chirilgan.")
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role', 'phone', 'date_joined', 'is_superuser']
        read_only_fields = ['is_superuser', 'date_joined']


class ChangePasswordSerializer(serializers.Serializer):
    """Parol o'zgartirish uchun — eski parol talab qilinadi."""
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        _validate_password_strength(value)
        return value
