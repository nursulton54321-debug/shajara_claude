from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User, SiteSetting, OTPCode
from .serializers import RegisterSerializer, LoginSerializer, UserSerializer, ChangePasswordSerializer
from .permissions import IsAdmin
from apps.persons.models import Invite, Person
from .telegram_otp import send_otp as _send_telegram_otp
from .sms_otp import send_sms

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user':    UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]

class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdmin]


class MeUpdateView(APIView):
    """Foydalanuvchi o'z profilini yangilaydi."""
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        user = request.user
        allowed = ['first_name', 'last_name', 'email', 'phone']
        for k in allowed:
            if k in request.data:
                setattr(user, k, request.data[k])
        user.save()
        return Response(UserSerializer(user).data)


class ChangePasswordView(APIView):
    """Parol o'zgartirish — eski parol talab qilinadi."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        # Eski parolni tekshirish
        if not authenticate(username=user.username, password=serializer.validated_data['old_password']):
            return Response({'old_password': ['Eski parol noto\'g\'ri.']}, status=status.HTTP_400_BAD_REQUEST)

        # Yangi parolni o'rnatish (set_password ichida hash qilinadi)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'detail': 'Parol muvaffaqiyatli o\'zgartirildi.'}, status=status.HTTP_200_OK)


class InviteRegisterView(APIView):
    """4.1 — Invite token orqali ro'yxatdan o'tish."""
    permission_classes = [AllowAny]

    def post(self, request):
        token    = request.data.get('token')
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        first_name = request.data.get('first_name', '').strip()
        last_name  = request.data.get('last_name', '').strip()

        if not all([token, username, password]):
            return Response({'error': 'token, username, password majburiy'}, status=400)

        try:
            invite = Invite.objects.select_related('person').get(token=token)
        except Invite.DoesNotExist:
            return Response({'error': 'Invite topilmadi'}, status=404)

        if not invite.is_valid:
            return Response({'error': "Invite muddati o'tgan yoki allaqachon ishlatilgan"}, status=400)

        if User.objects.filter(username=username).exists():
            return Response({'error': 'Bu username band'}, status=400)

        user = User.objects.create_user(
            username=username, password=password,
            first_name=first_name, last_name=last_name,
            invite_token=str(token),
        )

        # Shaxsga bog'lash
        if invite.person:
            invite.person.linked_user = user
            invite.person.save(update_fields=['linked_user'])

        invite.used    = True
        invite.used_by = user
        invite.save(update_fields=['used', 'used_by'])

        refresh = RefreshToken.for_user(user)
        return Response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user':    UserSerializer(user).data,
        }, status=201)


# ── Site PIN ────────────────────────────────────────────────────

class VerifyPinView(APIView):
    """Sayt kirish PIN kodini tekshiradi."""
    permission_classes = [AllowAny]

    def post(self, request):
        pin = str(request.data.get('pin', '')).strip()
        setting = SiteSetting.get()
        if pin == setting.site_pin:
            return Response({'ok': True})
        return Response({'ok': False, 'detail': "PIN noto'g'ri."}, status=400)


class SiteSettingView(APIView):
    """Superadmin PIN va sayt sozlamalarini o'zgartiradi."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_superuser:
            return Response({'detail': 'Ruxsat yo\'q.'}, status=403)
        s = SiteSetting.get()
        return Response({'site_pin': s.site_pin})

    def patch(self, request):
        if not request.user.is_superuser:
            return Response({'detail': 'Ruxsat yo\'q.'}, status=403)
        s = SiteSetting.get()
        new_pin = str(request.data.get('site_pin', '')).strip()
        if len(new_pin) < 4:
            return Response({'detail': "PIN kamida 4 raqam bo'lishi kerak."}, status=400)
        s.site_pin = new_pin
        s.save()
        return Response({'site_pin': s.site_pin})


# ── Telegram OTP ────────────────────────────────────────────────

def _deliver_otp(phone: str, code: str) -> bool:
    """SMS → Telegram ketma-ketlikda yuboradi. Dev rejimda console."""
    from django.conf import settings
    # 1. SMS (Eskiz.uz)
    if send_sms(phone, code):
        return True
    # 2. Telegram (DB da chat_id bo'lsa)
    if _send_telegram_otp(phone, code):
        return True
    # Dev rejimda server consolega chiqar — frontend ko'rmaydi
    if settings.DEBUG:
        print(f'[DEV OTP] {phone} → {code}')
    return False


class SendOTPView(APIView):
    """Telefon raqamga SMS yoki Telegram orqali OTP yuboradi."""
    permission_classes = [AllowAny]

    def post(self, request):
        phone = str(request.data.get('phone', '')).strip()
        if not phone:
            return Response({'detail': 'Telefon raqam kiritilmagan.'}, status=400)

        # Bitta raqam bittadan ortiq ro'yxatdan o'tolmaydi
        if User.objects.filter(phone=phone).exists():
            return Response(
                {'detail': 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan.'},
                status=400,
            )

        otp = OTPCode.generate(phone)
        _deliver_otp(phone, otp.code)

        return Response({'detail': "Kod yuborildi. 1 daqiqa ichida kiriting."})


class VerifyOTPView(APIView):
    """OTP kodni tekshiradi — to'g'ri bo'lsa register qiladi."""
    permission_classes = [AllowAny]

    def post(self, request):
        phone    = str(request.data.get('phone', '')).strip()
        code     = str(request.data.get('code', '')).strip()
        username = str(request.data.get('username', '')).strip()
        password = str(request.data.get('password', '')).strip()
        first_name = str(request.data.get('first_name', '')).strip()
        last_name  = str(request.data.get('last_name', '')).strip()

        try:
            otp = OTPCode.objects.filter(phone=phone, code=code, is_used=False).latest('created_at')
        except OTPCode.DoesNotExist:
            return Response({'detail': "Kod noto'g'ri."}, status=400)

        if not otp.is_valid():
            return Response({'detail': "Kod muddati tugagan. Qayta yuboring."}, status=400)

        otp.is_used = True
        otp.save()

        # Foydalanuvchi yaratish
        if User.objects.filter(username=username).exists():
            return Response({'detail': "Bu username band."}, status=400)

        if phone and User.objects.filter(phone=phone).exists():
            return Response({'detail': "Bu telefon raqam allaqachon ro'yxatdan o'tgan."}, status=400)

        user = User.objects.create_user(
            username=username, password=password,
            first_name=first_name, last_name=last_name,
            phone=phone,
        )
        refresh = RefreshToken.for_user(user)
        return Response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user':    UserSerializer(user).data,
        }, status=201)
