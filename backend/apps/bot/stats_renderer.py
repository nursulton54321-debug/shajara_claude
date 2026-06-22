"""
Statistika infografika rasmlari — Pillow.
4 ta rasm: umumiy, oylar, avlodlar, rekordlar.
"""
import io, os, math, random
from datetime import date
from PIL import Image, ImageDraw, ImageFont

# ── Ranglar ──────────────────────────────────────────────────────────────────
BG_TOP   = (6,  10, 28)
BG_BOT   = (14, 22, 52)
CARD_BG  = (16, 24, 58)
CARD_BDR = (40, 55, 120)

BLUE   = (99,  102, 241)
PINK   = (236, 72,  153)
GREEN  = (34,  197, 94)
GRAY   = (107, 114, 128)
AMBER  = (245, 158, 11)
TEAL   = (20,  184, 166)
PURPLE = (168, 85,  247)
ORANGE = (249, 115, 22)
RED    = (239, 68,  68)
CYAN   = (6,   182, 212)

TEXT_H  = (220, 228, 255)
TEXT_S  = (150, 165, 210)
TEXT_DIM = (90, 105, 150)

MONTHS_UZ = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun',
             'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']


# ── Font ─────────────────────────────────────────────────────────────────────
def _font(size, bold=False):
    if bold:
        paths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
            '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
            '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
            'C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/calibrib.ttf',
            'C:/Windows/Fonts/arialbd.ttf',
        ]
    else:
        paths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
            '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
            'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/calibri.ttf',
            'C:/Windows/Fonts/arial.ttf',
        ]
    for p in paths:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except: pass
    try: return ImageFont.load_default(size=max(size, 10))
    except: return ImageFont.load_default()

def _tw(draw, text, font):
    bb = draw.textbbox((0,0), text, font=font)
    return bb[2] - bb[0]

def _th(draw, text, font):
    bb = draw.textbbox((0,0), text, font=font)
    return bb[3] - bb[1]


# ── Background ───────────────────────────────────────────────────────────────
def _bg(w, h):
    img = Image.new('RGB', (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        r = int(BG_TOP[0] + (BG_BOT[0]-BG_TOP[0])*t)
        g = int(BG_TOP[1] + (BG_BOT[1]-BG_TOP[1])*t)
        b = int(BG_TOP[2] + (BG_BOT[2]-BG_TOP[2])*t)
        draw.line([(0,y),(w,y)], fill=(r,g,b))
    rng = random.Random(7)
    for _ in range(120):
        sx,sy = rng.randint(0,w-1), rng.randint(0,h-1)
        c = rng.randint(120,200)
        draw.point((sx,sy), fill=(c,c,c+20))
    return img.convert('RGBA')


def _card(draw, x, y, w, h, r=14, fill=None, border=None):
    fill   = fill   or CARD_BG
    border = border or CARD_BDR
    draw.rounded_rectangle([x, y, x+w, y+h], radius=r, fill=fill, outline=border, width=2)


def _text(draw, text, x, y, font, color=TEXT_H, shadow=True, center_w=None):
    if center_w:
        x = x + (center_w - _tw(draw, text, font)) // 2
    if shadow:
        draw.text((x+1, y+1), text, font=font, fill=(0,0,0,120))
    draw.text((x, y), text, font=font, fill=color)


# ── Donut chart ───────────────────────────────────────────────────────────────
def _donut(draw, cx, cy, r_out, r_in, segments, gap_deg=2):
    """segments = [(value, color), ...]"""
    total = sum(v for v, _ in segments)
    if total == 0: return
    angle = -90
    for val, col in segments:
        sweep = val / total * 360 - gap_deg
        if sweep <= 0: continue
        draw.arc([cx-r_out, cy-r_out, cx+r_out, cy+r_out],
                 angle, angle+sweep, fill=col, width=r_out-r_in)
        angle += val / total * 360


def _donut_segment_labels(draw, cx, cy, r_out, r_in, segments, fn, gap_deg=3):
    """Har bir segment o'rtasiga sonni yozadi."""
    total = sum(v for v, _ in segments)
    if total == 0:
        return
    r_mid = (r_out + r_in) // 2   # halqa o'rtasi
    angle = -90
    for val, col in segments:
        if val == 0:
            angle += val / total * 360
            continue
        sweep = val / total * 360 - gap_deg
        if sweep < 15:           # juda kichik segment — yozma
            angle += val / total * 360
            continue
        mid_a = math.radians(angle + sweep / 2)
        lx = int(cx + r_mid * math.cos(mid_a))
        ly = int(cy + r_mid * math.sin(mid_a))
        label = str(val)
        tw = _tw(draw, label, fn)
        th = _th(draw, label, fn)
        # qora soya
        draw.text((lx - tw//2 + 1, ly - th//2 + 1), label, font=fn, fill=(0,0,0,180))
        draw.text((lx - tw//2,     ly - th//2),     label, font=fn, fill=(255,255,255))
        angle += val / total * 360


def _donut_label(draw, cx, cy, text1, text2, fn_big, fn_small):
    tw1 = _tw(draw, text1, fn_big)
    tw2 = _tw(draw, text2, fn_small)
    th1 = _th(draw, text1, fn_big)
    draw.text((cx - tw1//2, cy - th1//2 - 4), text1, font=fn_big, fill=TEXT_H)
    draw.text((cx - tw2//2, cy + th1//2 + 2), text2, font=fn_small, fill=TEXT_S)


# ── Bar chart ─────────────────────────────────────────────────────────────────
def _bars(draw, x, y, w, h, values, labels, colors, max_val=None,
          bar_gap=6, show_val=True, fn_label=None, fn_val=None):
    """Horizontal bar chart."""
    if not values: return
    max_val = max_val or (max(values) or 1)
    n = len(values)
    bar_h = (h - bar_gap*(n-1)) // n
    fn_label = fn_label or _font(10)
    fn_val   = fn_val   or _font(10, bold=True)
    for i, (val, label, col) in enumerate(zip(values, labels, colors)):
        by = y + i * (bar_h + bar_gap)
        bar_w = int(val / max_val * w)
        # Track
        draw.rounded_rectangle([x, by, x+w, by+bar_h], radius=bar_h//2,
                                fill=(30,40,80), outline=(40,55,100), width=1)
        # Fill
        if bar_w > bar_h:
            draw.rounded_rectangle([x, by, x+bar_w, by+bar_h], radius=bar_h//2, fill=col)
        elif bar_w > 0:
            draw.ellipse([x, by, x+bar_h, by+bar_h], fill=col)
        # Label
        lbl_y = by + (bar_h - _th(draw, label, fn_label)) // 2
        draw.text((x - _tw(draw, label, fn_label) - 8, lbl_y), label,
                  font=fn_label, fill=TEXT_S)
        # Value
        if show_val and val > 0:
            val_str = str(val)
            vx = x + bar_w + 6
            vy = by + (bar_h - _th(draw, val_str, fn_val)) // 2
            draw.text((vx, vy), val_str, font=fn_val, fill=TEXT_H)


def _vbars(draw, x, y, w, h, values, labels, colors, max_val=None,
           bar_gap=8, fn_label=None, fn_val=None):
    """Vertical bar chart."""
    if not values: return
    max_val = max_val or (max(values) or 1)
    n = len(values)
    bar_w = (w - bar_gap*(n-1)) // n
    fn_label = fn_label or _font(9)
    fn_val   = fn_val   or _font(10, bold=True)
    for i, (val, label, col) in enumerate(zip(values, labels, colors)):
        bx = x + i * (bar_w + bar_gap)
        bar_h_px = int(val / max_val * h) if max_val else 0
        # Track
        draw.rounded_rectangle([bx, y, bx+bar_w, y+h], radius=4,
                                fill=(30,40,80), outline=(40,55,100), width=1)
        # Fill
        if bar_h_px > 0:
            draw.rounded_rectangle([bx, y+h-bar_h_px, bx+bar_w, y+h],
                                   radius=4, fill=col)
        # Value
        if val > 0:
            vs = str(val)
            vx = bx + (bar_w - _tw(draw, vs, fn_val)) // 2
            draw.text((vx, y+h-bar_h_px-18), vs, font=fn_val, fill=TEXT_H)
        # Label
        lx = bx + (bar_w - _tw(draw, label, fn_label)) // 2
        draw.text((lx, y+h+4), label, font=fn_label, fill=TEXT_S)


def _section_title(draw, x, y, title, fn, accent_col=BLUE):
    draw.rounded_rectangle([x-4, y+2, x+3, y+_th(draw,title,fn)-2],
                            radius=2, fill=accent_col)
    draw.text((x+8, y), title, font=fn, fill=TEXT_H)


# ── Stat card (mini) ─────────────────────────────────────────────────────────
def _stat_card(draw, canvas, x, y, w, h, value, label, icon, color, fn_big, fn_small):
    _card(draw, x, y, w, h, r=12, fill=(16,24,58),
          border=(*color[:3], 255) if len(color)==3 else color)
    # Icon bg circle
    draw.ellipse([x+10, y+10, x+42, y+42], fill=(*color, 40) if len(color)==3 else color)
    fn_icon = _font(14)
    draw.text((x+18, y+14), icon, font=fn_icon, fill=color)
    # Value
    vw = _tw(draw, value, fn_big)
    draw.text((x + w//2 - vw//2, y+14), value, font=fn_big, fill=TEXT_H)
    # Label
    lw = _tw(draw, label, fn_small)
    draw.text((x + w//2 - lw//2, y+h-22), label, font=fn_small, fill=TEXT_S)


# ── Legend item ──────────────────────────────────────────────────────────────
def _legend(draw, x, y, items, fn, gap=20):
    for color, label in items:
        draw.rounded_rectangle([x, y+2, x+12, y+14], radius=3, fill=color)
        draw.text((x+16, y), label, font=fn, fill=TEXT_S)
        x += _tw(draw, label, fn) + 32


# ─────────────────────────────────────────────────────────────────────────────
#  RASM 1: Umumiy ko'rsatkichlar
# ─────────────────────────────────────────────────────────────────────────────
def render_overview(stats: dict) -> bytes:
    S = 2
    W, H = 900, 520
    sw, sh = W*S, H*S
    canvas = _bg(sw, sh)
    draw   = ImageDraw.Draw(canvas)

    fn_title = _font(22*S, bold=True)
    fn_h     = _font(16*S, bold=True)
    fn_m     = _font(13*S)
    fn_s     = _font(11*S)
    fn_num   = _font(28*S, bold=True)
    fn_icon  = _font(18*S)

    # Title
    title = "📊  UMUMIY STATISTIKA"
    _text(draw, title, 0, 28*S, fn_title, center_w=sw)

    # ── Top stat cards ──────────────────────────────────────────────────────
    cards = [
        (str(stats['total']),     "Jami a'zolar",    '👨‍👩‍👧‍👦', BLUE),
        (str(stats['alive']),     "Tirik",           '💚',    GREEN),
        (str(stats['deceased']),  "Vafot etgan",     '🕯️',   GRAY),
        (str(stats['with_photo']),"Rasmi bor",       '📸',    TEAL),
    ]
    cw, ch = 180*S, 90*S
    cx_start = (sw - len(cards)*cw - (len(cards)-1)*14*S) // 2
    for i, (val, lbl, icon, col) in enumerate(cards):
        cx = cx_start + i*(cw + 14*S)
        _card(draw, cx, 68*S, cw, ch, r=14*S, fill=(16,24,58), border=col)
        # Top stripe
        draw.rounded_rectangle([cx+2, 68*S+2, cx+cw-2, 68*S+5*S],
                                radius=12*S, fill=col)
        # Value
        vw = _tw(draw, val, fn_num)
        draw.text((cx+(cw-vw)//2, 72*S+6*S), val, font=fn_num, fill=col)
        # Label
        lw = _tw(draw, lbl, fn_s)
        draw.text((cx+(cw-lw)//2, 72*S+42*S), lbl, font=fn_s, fill=TEXT_S)

    # ── Jins donut ──────────────────────────────────────────────────────────
    male = stats.get('male', 0)
    female = stats.get('female', 0)
    total = male + female or 1

    d_cx, d_cy = 195*S, 330*S
    d_r_out, d_r_in = 80*S, 50*S
    _donut(draw, d_cx, d_cy, d_r_out, d_r_in,
           [(male, BLUE), (female, PINK)], gap_deg=3)
    # Markazda jami son
    _donut_label(draw, d_cx, d_cy, f"{male+female}", "Jami", fn_h, fn_s)
    # Segment ichida sonlar
    _donut_segment_labels(draw, d_cx, d_cy, d_r_out, d_r_in,
                          [(male, BLUE), (female, PINK)], fn_s)

    # Legend
    mp = f"{male/total*100:.0f}%"
    fp = f"{female/total*100:.0f}%"
    _legend(draw, d_cx-80*S, d_cy+95*S,
            [(BLUE, f'👨 Erkak {male} ({mp})'), (PINK, f'👩 Ayol {female} ({fp})')], fn_s)
    _section_title(draw, d_cx-80*S, d_cy-100*S, "JINS NISBATI", fn_m, BLUE)

    # ── Hayot holati donut ───────────────────────────────────────────────────
    alive    = stats.get('alive', 0)
    deceased = stats.get('deceased', 0)
    h_cx, h_cy = 490*S, 330*S
    _donut(draw, h_cx, h_cy, d_r_out, d_r_in,
           [(alive, GREEN), (deceased, GRAY)], gap_deg=3)
    _donut_label(draw, h_cx, h_cy, f"{alive+deceased}", "Jami", fn_h, fn_s)
    _donut_segment_labels(draw, h_cx, h_cy, d_r_out, d_r_in,
                          [(alive, GREEN), (deceased, GRAY)], fn_s)

    at = alive+deceased or 1
    _legend(draw, h_cx-90*S, h_cy+95*S,
            [(GREEN, f'🟢 Tirik {alive} ({alive/at*100:.0f}%)'),
             (GRAY,  f'🔘 Vafot {deceased} ({deceased/at*100:.0f}%)')], fn_s)
    _section_title(draw, h_cx-90*S, h_cy-100*S, "HAYOT HOLATI", fn_m, GREEN)

    # ── Qo'shimcha ko'rsatkichlar (o'ng) ─────────────────────────────────────
    ex = [
        ("O'rtacha yosh",  f"{stats.get('avg_age_alive', 0):.0f} yosh", AMBER),
        ("Eng katta",      stats.get('oldest_name', '—'),               PURPLE),
        ("Eng yosh",       stats.get('youngest_name', '—'),             TEAL),
        ("Ko'p farzandli", stats.get('most_children_name', '—'),        ORANGE),
    ]
    card_w   = 200*S
    ex_x     = sw - card_w - 16*S
    ex_y     = 175*S
    pad_l    = 14*S          # chap ichki bo'shliq (chiziqdan keyin)
    stripe_w = 4*S           # rangli chap chiziq
    fn_lbl   = _font(10*S)
    fn_val   = _font(12*S, bold=True)
    line_h   = _th(draw, "A", fn_val) + 3*S  # bir qator balandligi

    def _wrap(text, font, max_w):
        """So'z chegarasida qatorga bo'lish."""
        words = text.split()
        lines, cur = [], ''
        for w in words:
            test = (cur + ' ' + w).strip()
            if _tw(draw, test, font) <= max_w:
                cur = test
            else:
                if cur:
                    lines.append(cur)
                cur = w
        if cur:
            lines.append(cur)
        return lines or [text]

    text_max_w = card_w - pad_l - stripe_w - 12*S

    for label, value, col in ex:
        val_lines = _wrap(value, fn_val, text_max_w)
        lbl_h   = _th(draw, label, fn_lbl) + 4*S
        val_area = len(val_lines) * line_h
        card_h  = lbl_h + val_area + 20*S   # padding top+bot

        _card(draw, ex_x, ex_y, card_w, card_h, r=10*S, fill=(14,20,50), border=col)
        # Rangli chap chiziq
        draw.rounded_rectangle([ex_x+2, ex_y+4, ex_x+2+stripe_w, ex_y+card_h-4],
                                radius=3, fill=col)
        tx = ex_x + stripe_w + pad_l
        # Label
        draw.text((tx, ex_y + 10*S), label, font=fn_lbl, fill=TEXT_S)
        # Value qatorlari
        vy = ex_y + lbl_h + 10*S
        for line in val_lines:
            draw.text((tx, vy), line, font=fn_val, fill=TEXT_H)
            vy += line_h

        ex_y += card_h + 8*S

    rgb = canvas.convert('RGB')
    out = rgb.resize((W, H), Image.LANCZOS)
    buf = io.BytesIO()
    out.save(buf, 'PNG', optimize=True)
    buf.seek(0)
    return buf.read()


# ─────────────────────────────────────────────────────────────────────────────
#  RASM 2: Oylar bo'yicha tug'ilganlar
# ─────────────────────────────────────────────────────────────────────────────
def render_monthly(monthly: list[int]) -> bytes:
    """monthly = [jan_count, feb_count, ..., dec_count]  (12 ta)"""
    S = 2
    W, H = 900, 460
    sw, sh = W*S, H*S
    canvas = _bg(sw, sh)
    draw   = ImageDraw.Draw(canvas)

    fn_title = _font(20*S, bold=True)
    fn_m     = _font(12*S)
    fn_s     = _font(10*S)
    fn_val   = _font(12*S, bold=True)

    _text(draw, "📅  OYLAR BO'YICHA TUG'ILGANLAR", 0, 26*S, fn_title, center_w=sw)

    # Vertical bars
    bar_x = 70*S
    bar_y = 70*S
    bar_w = sw - 140*S
    bar_h = sh - 160*S

    max_val = max(monthly) if monthly else 1

    # Month colors — gradient
    month_colors = [BLUE, TEAL, GREEN, AMBER, ORANGE, PINK,
                    PURPLE, RED, CYAN, BLUE, TEAL, GREEN]

    _vbars(draw, bar_x, bar_y, bar_w, bar_h,
           monthly, MONTHS_UZ, month_colors,
           max_val=max_val, bar_gap=6*S,
           fn_label=fn_s, fn_val=fn_val)

    # Grid lines
    for i in range(1, 4):
        gy = bar_y + bar_h - int(bar_h * i / 4)
        gv = int(max_val * i / 4)
        draw.line([(bar_x, gy), (bar_x+bar_w, gy)],
                  fill=(40, 55, 100, 120), width=1)
        draw.text((bar_x-28*S, gy-8*S), str(gv), font=fn_s, fill=TEXT_DIM)

    # Peak annotatsiya
    peak_m = monthly.index(max(monthly))
    _text(draw, f"📈 Eng ko'p: {MONTHS_UZ[peak_m]} ({max(monthly)} kishi)",
          0, sh-30*S, fn_m, color=AMBER, center_w=sw)

    rgb = canvas.convert('RGB')
    out = rgb.resize((W, H), Image.LANCZOS)
    buf = io.BytesIO()
    out.save(buf, 'PNG', optimize=True)
    buf.seek(0)
    return buf.read()


# ─────────────────────────────────────────────────────────────────────────────
#  RASM 3: Avlodlar + yosh guruhlari
# ─────────────────────────────────────────────────────────────────────────────
def render_generations(gen_data: list[tuple[str, int]],
                       age_groups: list[tuple[str, int]]) -> bytes:
    """
    gen_data   = [('I avlod', 2), ('II avlod', 5), ...]
    age_groups = [('0–18', 4), ('19–35', 6), ('36–60', 5), ('60+', 2)]
    """
    S = 2
    W, H = 900, 500
    sw, sh = W*S, H*S
    canvas = _bg(sw, sh)
    draw   = ImageDraw.Draw(canvas)

    fn_title = _font(20*S, bold=True)
    fn_h     = _font(14*S, bold=True)
    fn_m     = _font(12*S)
    fn_s     = _font(10*S)
    fn_val   = _font(13*S, bold=True)
    fn_lbl   = _font(11*S)

    _text(draw, "🌳  AVLODLAR & YOSH GURUHLARI", 0, 26*S, fn_title, center_w=sw)

    # ── Avlodlar (horizontal bars, chap) ─────────────────────────────────────
    _section_title(draw, 40*S, 70*S, "AVLODLAR BO'YICHA", fn_m, PURPLE)

    gen_colors = [BLUE, TEAL, GREEN, AMBER, ORANGE, PINK, PURPLE]
    g_vals  = [v for _, v in gen_data]
    g_lbls  = [l for l, _ in gen_data]
    g_cols  = [gen_colors[i % len(gen_colors)] for i in range(len(gen_data))]
    g_max   = max(g_vals) if g_vals else 1

    bar_x = 140*S
    bar_y = 95*S
    bar_w = 280*S
    bar_h = min(300*S, len(gen_data)*55*S)

    _bars(draw, bar_x, bar_y, bar_w, bar_h,
          g_vals, g_lbls, g_cols, max_val=g_max,
          bar_gap=8*S, fn_label=fn_lbl, fn_val=fn_val)

    # ── Yosh guruhlari (donut, o'rta) ────────────────────────────────────────
    _section_title(draw, 480*S, 70*S, "YOSH GURUHLARI", fn_m, AMBER)

    age_colors = [TEAL, BLUE, AMBER, RED]
    a_vals = [v for _, v in age_groups]
    a_lbls = [l for l, _ in age_groups]
    a_cols = age_colors[:len(age_groups)]
    a_total = sum(a_vals) or 1

    d_cx, d_cy = 620*S, 290*S
    d_r = 90*S
    _donut(draw, d_cx, d_cy, d_r, int(d_r*0.55),
           list(zip(a_vals, a_cols)), gap_deg=3)
    _donut_label(draw, d_cx, d_cy, str(sum(a_vals)), "kishi", fn_h, fn_s)

    # Legend
    leg_y = d_cy + d_r + 20*S
    for i, (lbl, val) in enumerate(age_groups):
        pct = val/a_total*100
        col = a_cols[i]
        row_x = d_cx - 80*S + (i%2)*90*S
        row_y = leg_y + (i//2)*22*S
        draw.rounded_rectangle([row_x, row_y+2, row_x+10, row_y+12],
                                radius=3, fill=col)
        draw.text((row_x+14, row_y), f"{lbl}: {val} ({pct:.0f}%)",
                  font=fn_s, fill=TEXT_S)

    rgb = canvas.convert('RGB')
    out = rgb.resize((W, H), Image.LANCZOS)
    buf = io.BytesIO()
    out.save(buf, 'PNG', optimize=True)
    buf.seek(0)
    return buf.read()


# ─────────────────────────────────────────────────────────────────────────────
#  RASM 4: Rekordlar & qiziqarli faktlar
# ─────────────────────────────────────────────────────────────────────────────
def render_records(records: list[dict]) -> bytes:
    """
    records = [
      {'icon':'🎂', 'title':'Eng katta', 'name':'...', 'value':'95 yosh', 'color': AMBER},
      ...
    ]
    """
    S = 2
    W, H = 900, 500
    sw, sh = W*S, H*S
    canvas = _bg(sw, sh)
    draw   = ImageDraw.Draw(canvas)

    fn_title = _font(20*S, bold=True)
    fn_h     = _font(15*S, bold=True)
    fn_m     = _font(12*S)
    fn_s     = _font(10*S)
    fn_icon  = _font(22*S)

    _text(draw, "🏆  REKORDLAR & QIZIQARLI FAKTLAR", 0, 26*S, fn_title, center_w=sw)

    # 2 qator, 3 ustun = 6 karta
    cols, rows = 3, 2
    cw = int((sw - 80*S - (cols-1)*16*S) / cols)
    ch = int((sh - 100*S - (rows-1)*16*S) / rows)

    for i, rec in enumerate(records[:cols*rows]):
        col_i = i % cols
        row_i = i // cols
        cx = 40*S + col_i*(cw + 16*S)
        cy = 80*S + row_i*(ch + 16*S)
        color = rec.get('color', BLUE)

        # Card
        _card(draw, cx, cy, cw, ch, r=14*S, fill=(14,20,50), border=color)
        # Top stripe
        draw.rounded_rectangle([cx+2, cy+2, cx+cw-2, cy+5*S],
                                radius=12*S, fill=color)

        # Icon
        draw.text((cx+14*S, cy+14*S), rec.get('icon','⭐'), font=fn_icon, fill=color)

        # Title
        draw.text((cx+52*S, cy+16*S), rec.get('title',''), font=fn_m, fill=TEXT_S)

        # Value (big)
        val = rec.get('value', '')
        vw = _tw(draw, val, fn_h)
        draw.text((cx + (cw-vw)//2, cy + ch//2 - 10*S), val,
                  font=fn_h, fill=color)

        # Name (small, bottom)
        name = rec.get('name', '')
        if name:
            # Truncate if too long
            while _tw(draw, name, fn_s) > cw - 20*S and len(name) > 3:
                name = name[:-4] + '...'
            nw = _tw(draw, name, fn_s)
            draw.text((cx + (cw-nw)//2, cy + ch - 26*S), name,
                      font=fn_s, fill=TEXT_S)

    rgb = canvas.convert('RGB')
    out = rgb.resize((W, H), Image.LANCZOS)
    buf = io.BytesIO()
    out.save(buf, 'PNG', optimize=True)
    buf.seek(0)
    return buf.read()
