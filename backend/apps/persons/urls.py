from django.urls import path
from . import views

urlpatterns = [
    path('', views.PersonListCreateView.as_view()),
    path('<int:pk>/', views.PersonDetailView.as_view()),
    path('tree/', views.PersonTreeView.as_view()),
    path('statistics/', views.StatisticsView.as_view()),
    path('birthdays/', views.BirthdaysView.as_view()),
    # Families (ko'p oila)
    path('families/',         views.FamilyListCreateView.as_view()),
    path('families/<int:pk>/', views.FamilyDetailView.as_view()),
    # CSV
    path('export/csv/', views.PersonExportCSVView.as_view()),
    path('import/csv/', views.PersonImportCSVView.as_view()),
    # Backup ZIP
    path('export/backup/', views.BackupZipView.as_view()),
    # Audit Log
    path('audit/', views.AuditLogListView.as_view()),
    # 4.1 Invite
    path('invites/',          views.InviteListCreateView.as_view()),
    path('invites/<int:pk>/', views.InviteDetailView.as_view()),
    path('invite/<str:token>/', views.InviteTokenView.as_view()),
    # 4.2 My Profile
    path('my-profile/', views.MyProfileView.as_view()),
    # 4.3 Public profile
    path('public/<slug:slug>/', views.PublicPersonView.as_view()),
    # 5.2 Did You Know
    path('did-you-know/', views.DidYouKnowView.as_view()),
    # 4.4 Push
    path('push/vapid-key/',    views.PushVapidKeyView.as_view()),
    path('push/subscribe/',    views.PushSubscribeView.as_view()),
    path('push/send-birthdays/', views.PushSendBirthdaysView.as_view()),
    # 11. Cron: ertalabki birthday push (X-Cron-Secret header bilan)
    path('cron/push-birthdays/', views.CronBirthdayPushView.as_view()),
    # 12. Share links
    path('share/',                views.ShareLinkListCreateView.as_view()),
    path('share/<uuid:token>/',   views.PublicTreeView.as_view()),
    # 15. AI relationship explainer
    path('ai/explain/',  views.AiExplainView.as_view()),
    # 16. OCR hujjat
    path('ai/ocr/',      views.OcrView.as_view()),
    # AI Chat (global)
    path('ai/chat/',     views.AiChatView.as_view()),
    # AI kalit holati tekshirish
    path('ai/status/',   views.AiStatusView.as_view()),
    # Reminders
    path('reminders/', views.ReminderListCreateView.as_view()),
    path('reminders/auto/', views.AutoCreateRemindersView.as_view()),
    path('reminders/stats/', views.ReminderStatsView.as_view()),
    path('reminders/<int:pk>/', views.ReminderDetailView.as_view()),
]
