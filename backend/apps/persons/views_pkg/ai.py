import logging
from ._base import *

log = logging.getLogger(__name__)

# ── Gemini / Groq helpers ─────────────────────────────────────────

GEMINI_MODELS_PRIORITY = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite-preview-06-17',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-flash-latest',
]

GROQ_MODELS_PRIORITY = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-versatile',
    'llama3-70b-8192',
    'llama-3.1-8b-instant',
    'gemma2-9b-it',
]


def _gemini_client():
    api_key = getattr(settings, 'GEMINI_API_KEY', '')
    try:
        # google-generativeai >= 2.0 (yangi SDK)
        from google import genai as google_genai
        return google_genai.Client(api_key=api_key)
    except (ImportError, AttributeError):
        # google-generativeai 0.x (eski SDK) — wrapper
        import google.generativeai as old_genai
        old_genai.configure(api_key=api_key)
        return old_genai


def _gemini_call(client, prompt, img_bytes=None, img_mime=None):
    last_err = None
    # Yangi SDK (google.genai.Client instance)
    try:
        from google.genai import types as gt
        for model in GEMINI_MODELS_PRIORITY:
            try:
                contents = (
                    [gt.Part.from_bytes(data=img_bytes, mime_type=img_mime or 'image/jpeg'), prompt]
                    if img_bytes else prompt
                )
                resp = client.models.generate_content(model=model, contents=contents)
                text = resp.text
                if not text:
                    raise Exception(f"{model}: bo'sh javob")
                return text.strip(), model
            except Exception as e:
                last_err = e
                continue
        if last_err:
            raise last_err
    except ImportError:
        pass

    # Eski SDK (google.generativeai module)
    for model in GEMINI_MODELS_PRIORITY:
        try:
            m = client.GenerativeModel(model)
            if img_bytes:
                import PIL.Image, io
                img = PIL.Image.open(io.BytesIO(img_bytes))
                resp = m.generate_content([img, prompt])
            else:
                resp = m.generate_content(prompt)
            text = resp.text
            if not text:
                raise Exception(f"{model}: bo'sh javob")
            return text.strip(), model
        except Exception as e:
            last_err = e
            continue
    raise last_err


def _gemini_chat(client, system_prompt, history, message):
    last_err = None
    # Yangi SDK
    try:
        from google.genai import types as gt
        for model in GEMINI_MODELS_PRIORITY:
            try:
                chat_history = [
                    gt.Content(role='user' if h['role'] == 'user' else 'model',
                               parts=[gt.Part(text=h['text'])])
                    for h in history
                ]
                chat = client.chats.create(
                    model=model,
                    config=gt.GenerateContentConfig(system_instruction=system_prompt),
                    history=chat_history,
                )
                resp = chat.send_message(message)
                text = resp.text
                if not text:
                    raise Exception(f"{model}: bo'sh javob")
                return text.strip(), model
            except Exception as e:
                last_err = e
                continue
        if last_err:
            raise last_err
    except ImportError:
        pass

    # Eski SDK
    for model in GEMINI_MODELS_PRIORITY:
        try:
            m = client.GenerativeModel(model, system_instruction=system_prompt)
            hist = []
            for h in history:
                hist.append({'role': 'user' if h['role'] == 'user' else 'model',
                             'parts': [h['text']]})
            chat = m.start_chat(history=hist)
            resp = chat.send_message(message)
            text = resp.text
            if not text:
                raise Exception(f"{model}: bo'sh javob")
            return text.strip(), model
        except Exception as e:
            last_err = e
            continue
    raise last_err


def _groq_call(prompt, system_prompt=None):
    from groq import Groq
    api_key = getattr(settings, 'GROQ_API_KEY', '')
    if not api_key:
        raise Exception('GROQ_API_KEY sozlanmagan')
    client = Groq(api_key=api_key)
    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    messages.append({'role': 'user', 'content': prompt})
    last_err = None
    for model in GROQ_MODELS_PRIORITY:
        try:
            resp = client.chat.completions.create(model=model, messages=messages, max_tokens=1024, temperature=0.7)
            return resp.choices[0].message.content.strip(), f'groq/{model}'
        except Exception as e:
            last_err = e
            continue
    raise last_err


def _groq_chat(system_prompt, history, message):
    from groq import Groq
    api_key = getattr(settings, 'GROQ_API_KEY', '')
    if not api_key:
        raise Exception('GROQ_API_KEY sozlanmagan')
    client = Groq(api_key=api_key)
    messages = [{'role': 'system', 'content': system_prompt}]
    for h in history:
        messages.append({'role': h['role'], 'content': h['text']})
    messages.append({'role': 'user', 'content': message})
    last_err = None
    for model in GROQ_MODELS_PRIORITY:
        try:
            resp = client.chat.completions.create(model=model, messages=messages, max_tokens=1024, temperature=0.7)
            return resp.choices[0].message.content.strip(), f'groq/{model}'
        except Exception as e:
            last_err = e
            continue
    raise last_err


def _ai_call(prompt, system_prompt=None, img_bytes=None, img_mime=None):
    gemini_key = getattr(settings, 'GEMINI_API_KEY', '')
    if gemini_key:
        try:
            client = _gemini_client()
            return _gemini_call(client, prompt, img_bytes=img_bytes, img_mime=img_mime)
        except Exception as e:
            if img_bytes:
                raise e

    groq_key = getattr(settings, 'GROQ_API_KEY', '')
    if groq_key and not img_bytes:
        try:
            return _groq_call(prompt, system_prompt=system_prompt)
        except Exception:
            pass

    raise Exception('Hech qanday AI xizmati ishlamadi')


def _ai_chat(system_prompt, history, message):
    gemini_key = getattr(settings, 'GEMINI_API_KEY', '')
    if gemini_key:
        try:
            client = _gemini_client()
            return _gemini_chat(client, system_prompt, history, message)
        except Exception as e:
            log.warning(f"[AI] Gemini xato: {e}")

    groq_key = getattr(settings, 'GROQ_API_KEY', '')
    log.info(f"[AI] GROQ_API_KEY mavjud: {bool(groq_key)}")
    if groq_key:
        try:
            return _groq_chat(system_prompt, history, message)
        except Exception as e:
            log.warning(f"[AI] Groq xato: {e}")
            raise Exception(f'Groq xato: {e}')

    raise Exception("Hech qanday AI xizmati ishlamadi — GROQ_API_KEY yo'q")


def _rel_template(name_a, name_b, relation_label, lca_name, depth_a, depth_b, path_names):
    parts = []
    if lca_name and depth_a > 0 and depth_b > 0:
        if depth_a == 1 and depth_b == 1:
            parts.append(
                f"{name_a} va {name_b} ikkalasi ham {lca_name}ning bevosita farzandlari. "
                f"Bu degani ular aka-uka yoki opa-singil bo'lishadi."
            )
        elif depth_a == 0:
            parts.append(
                f"{name_a} — {name_b}ning to'g'ridan-to'g'ri ajdodi. "
                f"Ular orasida {depth_b} avlod farqi mavjud."
            )
        elif depth_b == 0:
            parts.append(
                f"{name_b} — {name_a}ning to'g'ridan-to'g'ri avlodi. "
                f"Ular orasida {depth_a} avlod farqi mavjud."
            )
        else:
            parts.append(
                f"{name_a} va {name_b}ning umumiy ajdodi — {lca_name}. "
                f"{name_a} bu ajdoddan {depth_a} pog'ona, {name_b} esa {depth_b} pog'ona pastda turadi."
            )
    elif lca_name:
        parts.append(f"Ularning oilaviy bog'lanishi {lca_name} orqali o'tadi.")

    parts.append(f"Xulosa qilib aytganda: {name_a} — {name_b}ning {relation_label.lower()} hisoblanadi.")

    if path_names and len(path_names) >= 3:
        parts.append(f"Oila zanjiri bo'yicha yo'l: {' → '.join(path_names)}.")

    return ' '.join(parts)


# ── Views ─────────────────────────────────────────────────────────

class AiExplainView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        d = request.data
        name_a         = d.get('name_a') or 'Shaxs A'
        name_b         = d.get('name_b') or 'Shaxs B'
        relation_label = d.get('relation_label') or ''
        lca_name       = d.get('lca_name') or ''
        try:
            depth_a = int(d.get('depth_a') or 0)
        except (TypeError, ValueError):
            depth_a = 0
        try:
            depth_b = int(d.get('depth_b') or 0)
        except (TypeError, ValueError):
            depth_b = 0
        path_names = d.get('path_names') or []

        gemini_key = getattr(settings, 'GEMINI_API_KEY', '')
        groq_key   = getattr(settings, 'GROQ_API_KEY', '')
        if gemini_key or groq_key:
            try:
                chain_str = ' → '.join(str(n) for n in path_names) if path_names else '—'
                prompt = (
                    f"O'zbek tilida 2-3 ta qisqa, do'stona gap yoz (emoji ishlatma):\n"
                    f"Ikki shaxs: {name_a} va {name_b}.\n"
                    f"Munosabat: {relation_label}.\n"
                    f"Umumiy ajdod: {lca_name or 'mavjud emas'}.\n"
                    f"{name_a} ajdodgacha: {depth_a} pog'ona, {name_b} ajdodgacha: {depth_b} pog'ona.\n"
                    f"Oila zanjiri: {chain_str}.\n"
                    f"Oddiy, tushunarli tarzda tushuntir. Faqat asosiy ma'lumot."
                )
                text, used_model = _ai_call(prompt)
                if text:
                    return Response({'text': text, 'source': used_model})
            except Exception as e:
                log.warning(f"[AiExplain] AI xato, template ga tushadi: {e}")

        try:
            text = _rel_template(name_a, name_b, relation_label, lca_name, depth_a, depth_b, path_names)
        except Exception:
            text = f"{name_a} va {name_b} o'rtasida '{relation_label}' munosabati aniqlandi."
        return Response({'text': text, 'source': 'template'})


class OcrView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        img = request.FILES.get('image')
        if not img:
            return Response({'error': 'Rasm yuklanmadi'}, status=400)

        api_key = getattr(settings, 'GEMINI_API_KEY', '')
        if not api_key:
            return Response({'error': 'OCR uchun GEMINI_API_KEY kerak.', 'source': 'no_api'}, status=503)

        try:
            import re
            client    = _gemini_client()
            img_bytes = img.read()
            mime_type = img.content_type or 'image/jpeg'
            prompt = (
                "Bu hujjat/rasmdan quyidagi ma'lumotlarni JSON formatida chiqar:\n"
                "- full_name: to'liq ism-familiya-otasining ismi\n"
                "- birth_date: tug'ilgan sana YYYY-MM-DD formatida (topa olmasang null)\n"
                "- birth_place: tug'ilgan joy (topa olmasang null)\n"
                "- gender: 'male' yoki 'female' (topa olmasang null)\n"
                "- notes: boshqa foydali ma'lumotlar (ixtiyoriy)\n\n"
                "MUHIM: Faqat JSON qaytardir, boshqa hech narsa yozma.\n"
                "Misol: {\"full_name\": \"Karimov Ali Vohidovich\", \"birth_date\": \"1990-05-20\", "
                "\"birth_place\": \"Toshkent shahri\", \"gender\": \"male\", \"notes\": \"\"}"
            )
            raw, used_model = _gemini_call(client, prompt, img_bytes=img_bytes, img_mime=mime_type)
            m = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw, re.DOTALL)
            if not m:
                m = re.search(r'\{.*\}', raw, re.DOTALL)
            if m:
                import json as _json
                json_str = m.group(1) if m.lastindex else m.group()
                data = _json.loads(json_str)
                return Response({'data': data, 'source': f'gemini/{used_model}'})
            return Response({'error': 'AI javob tushunarsiz', 'raw': raw}, status=422)
        except Exception as e:
            err_str = str(e)
            if '429' in err_str or 'RESOURCE_EXHAUSTED' in err_str:
                return Response({'error': "Gemini API kvotasi tugagan.", 'source': 'quota_exceeded'}, status=429)
            if '403' in err_str or 'PERMISSION_DENIED' in err_str:
                return Response({'error': "API kaliti noto'g'ri yoki ruxsat yo'q.", 'source': 'auth_error'}, status=403)
            return Response({'error': f'AI xatosi: {err_str[:200]}'}, status=500)


class AiChatView(APIView):
    permission_classes = [IsAuthenticated]

    def _find_person_in_db(self, user, message):
        msg_lower = message.lower()
        persons = Person.objects.filter(created_by=user)
        best = None
        best_score = 0
        for p in persons:
            name_parts = p.full_name.lower().split()
            score = sum(1 for part in name_parts if len(part) > 2 and part in msg_lower)
            if score > best_score:
                best_score = score
                best = p
        return best if best_score >= 2 else None

    def post(self, request):
        message      = request.data.get('message', '').strip()
        history      = request.data.get('history', [])
        ctx          = request.data.get('context', {})
        if not message:
            return Response({'error': "Xabar bo'sh"}, status=400)

        user         = request.user
        user_name    = user.get_full_name() or user.username
        total        = ctx.get('total_persons', 0)
        current_page = ctx.get('page', '')
        persons_list = ctx.get('persons', [])

        plist_str = ', '.join(
            f"{p['name']} ({p.get('birth_year') or '?'})"
            for p in persons_list[:40]
        ) if persons_list else "Ma'lumot yuborilmagan."

        found_person = self._find_person_in_db(user, message)
        is_person_query = any(w in message.lower() for w in [
            'haqida', 'kim', "ma'lumot", "tug'ilgan", 'yoshi', 'qayer'
        ])
        if found_person and is_person_query:
            p = found_person
            lines = [f"👤 **{p.full_name}** haqida ma'lumot:"]
            lines.append(f"• Tug'ilgan sana: {p.birth_date if p.birth_date else 'kiritilmagan'}")
            if p.birth_place:
                lines.append(f"• Tug'ilgan joy: {p.birth_place}")
            lines.append(f"• Jins: {'Erkak 👨' if p.gender == 'male' else 'Ayol 👩' if p.gender == 'female' else 'kiritilmagan'}")
            if p.death_date:
                lines.append(f"• Vafot sanasi: {p.death_date}")
            if p.phone:
                lines.append(f"• Telefon: {p.phone}")
            lines.append("\n💡 Qarindoshlik ma'lumoti uchun /relationship sahifasiga o'ting.")
            return Response({'text': '\n'.join(lines), 'source': 'db_direct'})

        person_data_str = ''
        if found_person:
            p = found_person
            fields = [f"Ismi: {p.full_name}"]
            if p.birth_date:  fields.append(f"Tug'ilgan sana: {p.birth_date}")
            if p.birth_place: fields.append(f"Tug'ilgan joy: {p.birth_place}")
            if p.gender:      fields.append(f"Jins: {'Erkak' if p.gender == 'male' else 'Ayol'}")
            person_data_str = "\n\nDB MA'LUMOTI:\n" + "\n".join(fields)
            person_data_str += "\nOTA/ONA/FARZAND MA'LUMOTI YO'Q — bu haqda hech narsa yozma."

        system_prompt = f"""Sen "Shajara" oila daraxti ilovasining AI yordamchisisisan.

FOYDALANUVCHI: {user_name}
JORIY SAHIFA: {current_page}
OILADAGI JAMI A'ZOLAR: {total} ta

ILOVA BO'LIMLARI:
🌲 /tree — Vizual oila daraxti
👥 /persons — Barcha a'zolar ro'yxati
➕ /persons/add — Yangi shaxs qo'shish
📊 /statistics — Tahlil va grafiklar
🔗 /relationship — Qarindoshlikni hisoblash
👤 /my-profile — O'z profilingni bog'lash
🔔 /notifications — Tug'ilgan kun eslatmalari

OILADAGI A'ZOLAR:
{plist_str}{person_data_str}

QATIY QOIDALAR:
1. O'zbekcha javob ber, qisqa va aniq (2-4 gap)
2. Shaxs haqida SO'RALGANDA: FAQAT "DB MA'LUMOTI" bo'limini ishlat
3. Ota, ona, aka, uka, farzand munosabatlarini HECH QACHON o'zingdan TO'QIMA
4. Qarindoshlik bilmoqchi bo'lsa: "/relationship sahifasiga o'ting" de
5. Bazada yo'q ma'lumotni ixtiro qilma"""

        try:
            text, used_model = _ai_chat(system_prompt, history[-12:], message)
            return Response({'text': text, 'source': used_model})
        except Exception as e:
            err_str = str(e)
            if '429' in err_str or 'RESOURCE_EXHAUSTED' in err_str:
                return Response({
                    'text': "⚠️ AI kvotasi tugagan.\n\nGroq bepul kaliti oling: https://console.groq.com/keys",
                    'source': 'quota_error',
                })
            return Response({'text': f"⚠️ Xato: {err_str[:200]}", 'source': 'server_error'})


class AiStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        api_key = getattr(settings, 'GEMINI_API_KEY', '')
        if not api_key:
            return Response({'status': 'no_key', 'message': 'GEMINI_API_KEY sozlanmagan.'})
        try:
            client    = _gemini_client()
            text, mdl = _gemini_call(client, 'Salom! Qisqa test.')
            return Response({
                'status':  'ok',
                'model':   mdl,
                'message': f"✅ AI ishlaydi! Model: {mdl}",
                'sample':  text[:60],
            })
        except Exception as e:
            err = str(e)
            if '429' in err or 'RESOURCE_EXHAUSTED' in err:
                return Response({'status': 'quota_exceeded', 'message': "⚠️ Kvota tugagan."})
            if '403' in err or 'PERMISSION_DENIED' in err:
                return Response({'status': 'invalid_key', 'message': "❌ API kalit noto'g'ri."})
            return Response({'status': 'error', 'message': err[:200]})
