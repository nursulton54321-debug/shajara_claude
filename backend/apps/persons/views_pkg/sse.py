"""
Server-Sent Events — real-time yangilanishlar.
Frontend /api/persons/events/ ga ulanib, person create/update/delete eventlarini oladi.
"""
import asyncio
import json
import logging
from datetime import datetime

from django.http import StreamingHttpResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)

# Barcha aktiv SSE ulanishlar: { user_id: [queue, ...] }
_subscribers: dict[int, list] = {}


def notify(user_id: int, event: str, data: dict):
    """Signallardan chaqiriladi — barcha SSE ulanuvchilariga xabar yuboradi."""
    queues = _subscribers.get(user_id, [])
    msg = f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
    for q in queues:
        try:
            q.put_nowait(msg)
        except Exception:
            pass


@method_decorator(csrf_exempt, name='dispatch')
class PersonEventsView(View):
    """GET /api/persons/events/ — SSE stream."""

    def get(self, request):
        user = request.user
        if not user or not user.is_authenticated:
            from django.http import HttpResponse
            return HttpResponse(status=401)

        user_id = user.id
        q: asyncio.Queue = asyncio.Queue(maxsize=50)

        _subscribers.setdefault(user_id, []).append(q)

        def stream():
            # Ulanish tasdiqi
            yield "event: connected\ndata: {}\n\n"
            try:
                while True:
                    try:
                        # Sinxron polling — 30s timeout (keep-alive)
                        import queue as _queue_mod
                        import threading

                        result = [None]
                        event_done = threading.Event()

                        def _get():
                            try:
                                result[0] = q.get_nowait()
                            except Exception:
                                pass
                            event_done.set()

                        t = threading.Timer(0.5, _get)
                        t.start()
                        event_done.wait(timeout=30)
                        t.cancel()

                        if result[0]:
                            yield result[0]
                        else:
                            # keep-alive ping
                            yield ": ping\n\n"
                    except GeneratorExit:
                        break
            finally:
                subs = _subscribers.get(user_id, [])
                if q in subs:
                    subs.remove(q)
                if not subs:
                    _subscribers.pop(user_id, None)

        response = StreamingHttpResponse(stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response
