from ._base import *


class PushVapidKeyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'public_key': settings.VAPID_PUBLIC_KEY})


class PushSubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        endpoint = request.data.get('endpoint')
        p256dh   = request.data.get('keys', {}).get('p256dh', '')
        auth     = request.data.get('keys', {}).get('auth', '')
        if not endpoint:
            return Response({'error': 'endpoint majburiy'}, status=400)
        sub, created = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={'user': request.user, 'p256dh': p256dh, 'auth': auth}
        )
        return Response({'status': 'subscribed', 'created': created})

    def delete(self, request):
        endpoint = request.data.get('endpoint')
        if endpoint:
            PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response({'status': 'unsubscribed'})


class PushSendBirthdaysView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from pywebpush import webpush, WebPushException
        import json as _json

        days_ahead = int(request.data.get('days', 7))
        today = timezone.now().date()
        upcoming = []
        for p in Person.objects.filter(birth_date__isnull=False, death_date__isnull=True):
            try:
                bd = p.birth_date.replace(year=today.year)
            except ValueError:
                bd = p.birth_date.replace(year=today.year, day=28)
            if bd < today:
                try:
                    bd = bd.replace(year=today.year + 1)
                except ValueError:
                    bd = bd.replace(year=today.year + 1, day=28)
            days_left = (bd - today).days
            if 0 <= days_left <= days_ahead:
                upcoming.append({'name': p.full_name, 'days': days_left, 'date': str(bd)})

        if not upcoming:
            return Response({'sent': 0, 'message': "Yaqin tug'ilgan kun yo'q"})

        subs = PushSubscription.objects.filter(user=request.user)
        sent = 0
        errors = []
        for sub in subs:
            for b in upcoming:
                title = "🎂 Tug'ilgan kun!" if b['days'] == 0 else f"🎂 {b['days']} kun qoldi"
                suffix = ' — bugun!' if b['days'] == 0 else f" — {b['date']}"
                body  = f"{b['name']}{suffix}"
                payload = _json.dumps({'title': title, 'body': body, 'icon': '/favicon.ico'})
                try:
                    webpush(
                        subscription_info={'endpoint': sub.endpoint, 'keys': {'p256dh': sub.p256dh, 'auth': sub.auth}},
                        data=payload,
                        vapid_private_key=settings.VAPID_PRIVATE_KEY,
                        vapid_claims={'sub': f'mailto:{settings.VAPID_CLAIMS_EMAIL}'},
                    )
                    sent += 1
                except WebPushException as e:
                    errors.append(str(e)[:80])
                    if '410' in str(e) or '404' in str(e):
                        sub.delete()

        return Response({'sent': sent, 'upcoming': upcoming, 'errors': errors})


class CronBirthdayPushView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        secret = request.headers.get('X-Cron-Secret', '')
        expected = getattr(settings, 'CRON_SECRET', 'shajara-cron-2024')
        if secret != expected:
            return Response({'error': 'Ruxsat yoq'}, status=403)

        from pywebpush import webpush, WebPushException
        import json as _json

        days_ahead = int(request.data.get('days', 3))
        today = timezone.now().date()
        upcoming = []
        for p in Person.objects.filter(birth_date__isnull=False, death_date__isnull=True):
            try:
                bd = p.birth_date.replace(year=today.year)
            except ValueError:
                bd = p.birth_date.replace(year=today.year, day=28)
            if bd < today:
                try:
                    bd = bd.replace(year=today.year + 1)
                except ValueError:
                    bd = bd.replace(year=today.year + 1, day=28)
            days_left = (bd - today).days
            if 0 <= days_left <= days_ahead:
                upcoming.append({'name': p.full_name, 'days': days_left, 'id': p.id})

        if not upcoming:
            return Response({'sent': 0, 'message': "Yaqin tug'ilgan kun yo'q"})

        subs = PushSubscription.objects.select_related('user').all()
        sent = 0
        for sub in subs:
            for b in upcoming:
                if b['days'] == 0:
                    title = "🎂 Bugun tug'ilgan kun!"
                    body  = f"{b['name']} — bugun tug'ilgan kuni!"
                else:
                    title = f"🎂 {b['days']} kundan so'ng tug'ilgan kun"
                    body  = f"{b['name']} — {b['days']} kun qoldi"
                payload = _json.dumps({
                    'title': title, 'body': body,
                    'icon': '/favicon.ico', 'badge': '/favicon.ico',
                    'data': {'personId': b['id']},
                })
                try:
                    webpush(
                        subscription_info={'endpoint': sub.endpoint, 'keys': {'p256dh': sub.p256dh, 'auth': sub.auth}},
                        data=payload,
                        vapid_private_key=settings.VAPID_PRIVATE_KEY,
                        vapid_claims={'sub': f"mailto:{getattr(settings, 'VAPID_CLAIMS_EMAIL', 'admin@shajara.uz')}"},
                    )
                    sent += 1
                except WebPushException as e:
                    if '410' in str(e) or '404' in str(e):
                        sub.delete()

        return Response({'sent': sent, 'upcoming': len(upcoming), 'subscriptions': subs.count()})
