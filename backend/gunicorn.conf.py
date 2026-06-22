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
