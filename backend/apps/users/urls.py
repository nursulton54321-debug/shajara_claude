from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view()),
    path('login/', views.LoginView.as_view()),
    path('refresh/', TokenRefreshView.as_view()),
    path('me/', views.MeView.as_view()),
    path('me/update/', views.MeUpdateView.as_view()),
    path('me/change-password/', views.ChangePasswordView.as_view()),
    path('users/', views.UserListView.as_view()),
    path('users/<int:pk>/', views.UserDetailView.as_view()),
    # 4.1 Invite register
    path('invite-register/', views.InviteRegisterView.as_view()),
    # Site PIN
    path('verify-pin/', views.VerifyPinView.as_view()),
    path('site-settings/', views.SiteSettingView.as_view()),
    # Telegram OTP
    path('send-otp/', views.SendOTPView.as_view()),
    path('verify-otp/', views.VerifyOTPView.as_view()),
]
