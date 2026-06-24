"""
Gunicorn konfiguratsiyasi — Render.com deployment uchun.

MUHIM: workers = 1 bo'lishi SHART!
Bot ConversationHandler holati xotirada saqlanadi.
Bir nechta worker bo'lsa, har xil worker turli so'rovlarni
qabul qilib, holat yo'qoladi va bot to'xtab qoladi.
"""
import os

workers = 1
worker_class = "sync"
timeout = 120
bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
accesslog = "-"
errorlog = "-"
loglevel = "info"


def on_starting(server):
    """Har deploy/restart da migration avtomatik qo'llanadi."""
    import subprocess, sys
    result = subprocess.run(
        [sys.executable, "manage.py", "migrate", "--no-input"],
        capture_output=True, text=True
    )
    print("[gunicorn] migrate stdout:", result.stdout)
    if result.returncode != 0:
        print("[gunicorn] migrate stderr:", result.stderr)
