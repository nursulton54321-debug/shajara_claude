"""
Premium Family Tree Renderer — Pillow bilan chiroyli shajara daraxti rasmi.
"""
import io, os, math, random
from datetime import date
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

# ── Card dimensions ──────────────────────────────────────────────────────────
CARD_W     = 148
CARD_H     = 205
PHOTO_D    = 80          # photo diameter
H_GAP      = 28          # horizontal gap between sibling units
COUPLE_GAP = 10          # gap between husband & wife cards
V_GAP      = 120         # vertical gap between generations
PAD_X      = 90
PAD_Y      = 80
TITLE_H    = 100         # title area height

# ── Colors ───────────────────────────────────────────────────────────────────
BG_TOP    = (6, 10, 28)
BG_BOT    = (14, 22, 52)
BG_MID    = (10, 15, 38)

MALE_BG   = (18, 26, 68)
MALE_BDR  = (99, 102, 241)
MALE_ACC  = (129, 140, 248)

FEMALE_BG  = (48, 14, 36)
FEMALE_BDR = (236, 72, 153)
FEMALE_ACC = (249, 168, 212)

DEAD_BG   = (24, 28, 40)
DEAD_BDR  = (71, 78, 98)
DEAD_ACC  = (100, 110, 135)

LINE_COL  = (80, 100, 180, 160)
COUPLE_LINE = (200, 180, 80, 200)

TEXT_NAME = (230, 238, 255)
TEXT_YEAR = (200, 215, 245)   # yorqinroq
TEXT_ROLE = (190, 200, 230)


# ── Font helpers ─────────────────────────────────────────────────────────────
def _font(size, bold=False):
    if bold:
        candidates = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
            '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
            '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
            'C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/calibrib.ttf',
            'C:/Windows/Fonts/arialbd.ttf',
        ]
    else:
        candidates = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
            '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
            'C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/calibri.ttf',
            'C:/Windows/Fonts/arial.ttf',
        ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    try: return ImageFont.load_default(size=max(size, 10))
    except: return ImageFont.load_default()


def _text_w(draw, text, font):
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[2] - bb[0]


def _text_h(draw, text, font):
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[3] - bb[1]


# ── Background ───────────────────────────────────────────────────────────────
def _make_background(w, h):
    img = Image.new('RGB', (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        r = int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t)
        draw.line([(0, y), (w, y)], fill=(r, g, b))

    # Subtle radial glow center
    cx, cy = w // 2, h // 3
    for r in range(min(w, h) // 2, 0, -4):
        alpha = int(12 * (1 - r / (min(w, h) / 2)))
        if alpha <= 0:
            continue
        draw.ellipse([cx - r, cy - r, cx + r, cy + r],
                     outline=(40, 60, 140, alpha))

    # Stars
    rng = random.Random(42)
    for _ in range(280):
        sx = rng.randint(0, w - 1)
        sy = rng.randint(0, h - 1)
        rv = rng.random()
        if rv < 0.65:
            c = rng.randint(140, 200)
            draw.point((sx, sy), fill=(c, c, c + 20))
        elif rv < 0.90:
            c = rng.randint(180, 240)
            draw.ellipse([sx, sy, sx + 1, sy + 1], fill=(c, c + 10, c + 30))
        else:
            c = rng.randint(220, 255)
            draw.ellipse([sx - 1, sy - 1, sx + 2, sy + 2], fill=(c, c, c))

    return img


# ── Circular photo ───────────────────────────────────────────────────────────
def _load_circular_photo(path, size):
    try:
        img = Image.open(path).convert('RGBA')
        img = ImageOps.fit(img, (size, size), Image.LANCZOS, centering=(0.5, 0.2))
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
        img.putalpha(mask)
        return img
    except Exception:
        return None


def _default_avatar(size, gender, dead):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if dead:
        bg, acc = (35, 40, 55), DEAD_ACC
    elif gender == 'male':
        bg, acc = (22, 32, 80), MALE_ACC
    else:
        bg, acc = (55, 18, 42), FEMALE_ACC

    draw.ellipse([0, 0, size - 1, size - 1], fill=bg)
    # head
    hr = size // 5
    hx, hy = size // 2, size // 3
    draw.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=acc)
    # body arc
    bw = int(size * 0.38)
    draw.arc([hx - bw, hy + hr - 4, hx + bw, hy + hr + size // 2],
             190, 350, fill=acc, width=max(3, size // 16))
    return img


# ── Single card (scaled) ─────────────────────────────────────────────────────
def _draw_card_scaled(canvas, x, y, person, photo_cache,
                      scale, card_w, card_h, photo_d):
    """2x scaled koordinatalar bilan karta chizadi."""
    draw = ImageDraw.Draw(canvas)
    dead = bool(person.death_date)
    male = person.gender == 'male'

    if dead:
        bg, bdr, acc = DEAD_BG, DEAD_BDR, DEAD_ACC
    elif male:
        bg, bdr, acc = MALE_BG, MALE_BDR, MALE_ACC
    else:
        bg, bdr, acc = FEMALE_BG, FEMALE_BDR, FEMALE_ACC

    r = 16 * scale

    # Glow
    for i in range(22 * scale, 0, -4 * scale):
        a = int(30 * (1 - i / (22 * scale)))
        draw.rounded_rectangle([x - i, y - i, x + card_w + i, y + card_h + i],
                                radius=r + i, outline=(*bdr, a), width=1)

    # Card
    draw.rounded_rectangle([x, y, x + card_w, y + card_h],
                            radius=r, fill=bg, outline=bdr, width=scale * 2)

    # Top stripe
    stripe = 5 * scale
    draw.rounded_rectangle([x + scale, y + scale, x + card_w - scale, y + stripe + scale],
                            radius=r - 2, fill=bdr)

    # ── Photo ─────────────────────────────────────────────────────
    cx = x + card_w // 2
    py_ph = y + stripe + 18 * scale
    ring = 4 * scale
    draw.ellipse([cx - photo_d // 2 - ring, py_ph - ring,
                  cx + photo_d // 2 + ring, py_ph + photo_d + ring], fill=bdr)
    draw.ellipse([cx - photo_d // 2 - 1, py_ph - 1,
                  cx + photo_d // 2 + 1, py_ph + photo_d + 1], fill=(8, 12, 30))

    photo = photo_cache.get(person.id)
    if photo:
        canvas.paste(photo, (cx - photo_d // 2, py_ph), photo)
    else:
        avatar = _default_avatar(photo_d, person.gender, dead)
        canvas.paste(avatar, (cx - photo_d // 2, py_ph), avatar)

    if dead:
        overlay = Image.new('RGBA', (photo_d, photo_d), (20, 20, 35, 80))
        mask = Image.new('L', (photo_d, photo_d), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, photo_d - 1, photo_d - 1], fill=255)
        canvas.paste(overlay, (cx - photo_d // 2, py_ph), mask)

    # Status dot
    dot_col = (107, 114, 128) if dead else (34, 197, 94)
    ds = 8 * scale
    dx, dy = x + card_w - ds - 4 * scale, y + 10 * scale
    draw.ellipse([dx - scale, dy - scale, dx + ds + scale, dy + ds + scale],
                 outline=(20, 25, 50), width=scale)
    draw.ellipse([dx, dy, dx + ds, dy + ds], fill=dot_col)

    # ── Name ──────────────────────────────────────────────────────
    text_y = py_ph + photo_d + 8 * scale
    fn_bold = _font(11 * scale, bold=True)
    for line in [person.last_name or '', person.first_name or '',
                 (person.middle_name or '')[:12]]:
        if not line:
            continue
        tw = _text_w(draw, line, fn_bold)
        tx = cx - tw // 2
        draw.text((tx + scale, text_y + scale), line, font=fn_bold,
                  fill=(0, 0, 0, 100))
        draw.text((tx, text_y), line, font=fn_bold, fill=TEXT_NAME)
        text_y += 15 * scale

    # ── Years ─────────────────────────────────────────────────────
    years = ''
    if person.birth_date:
        years = str(person.birth_date.year)
    if person.death_date:
        years += f' — {person.death_date.year}'
    elif person.birth_date:
        age = (date.today() - person.birth_date).days // 365
        years += f'  ({age} yosh)'
    if dead:
        # Vafot etgan: ikki qator — yuqorida yillar, pastda tag
        fn_yr  = _font(11 * scale)
        fn_tag = _font(9 * scale)
        yr_y   = y + card_h - 38 * scale   # yuqoriroq
        tag_y  = y + card_h - 22 * scale
        if years:
            tw = _text_w(draw, years, fn_yr)
            draw.text((cx - tw // 2 + scale, yr_y + scale),
                      years, font=fn_yr, fill=(0, 0, 0, 160))
            draw.text((cx - tw // 2, yr_y),
                      years, font=fn_yr, fill=(220, 230, 255))   # yanada yorqin
        tag = '🌿 Vafot etgan'
        tw2 = _text_w(draw, tag, fn_tag)
        draw.text((cx - tw2 // 2, tag_y), tag,
                  font=fn_tag, fill=(180, 190, 215))
    else:
        if years:
            fn_yr = _font(11 * scale)
            tw = _text_w(draw, years, fn_yr)
            yr_y = y + card_h - 24 * scale
            draw.text((cx - tw // 2 + scale, yr_y + scale),
                      years, font=fn_yr, fill=(0, 0, 0, 160))
            draw.text((cx - tw // 2, yr_y),
                      years, font=fn_yr, fill=TEXT_YEAR)


# ── Single card ──────────────────────────────────────────────────────────────
def _draw_card(canvas, x, y, person, photo_cache):
    draw = ImageDraw.Draw(canvas)
    dead = bool(person.death_date)
    male = person.gender == 'male'

    if dead:
        bg, bdr, acc = DEAD_BG, DEAD_BDR, DEAD_ACC
    elif male:
        bg, bdr, acc = MALE_BG, MALE_BDR, MALE_ACC
    else:
        bg, bdr, acc = FEMALE_BG, FEMALE_BDR, FEMALE_ACC

    # Soft glow behind card
    glow_r = 22
    for i in range(glow_r, 0, -4):
        a = int(28 * (1 - i / glow_r))
        gx1, gy1 = x - i, y - i
        gx2, gy2 = x + CARD_W + i, y + CARD_H + i
        draw.rounded_rectangle([gx1, gy1, gx2, gy2], radius=20 + i,
                                outline=(*bdr, a), width=1)

    # Card background
    draw.rounded_rectangle([x, y, x + CARD_W, y + CARD_H],
                            radius=16, fill=bg, outline=bdr, width=2)

    # Top accent stripe
    stripe_h = 5
    draw.rounded_rectangle([x + 2, y + 2, x + CARD_W - 2, y + stripe_h + 2],
                            radius=14, fill=bdr)

    # ── Photo ────────────────────────────────────────────────
    cx = x + CARD_W // 2
    py = y + stripe_h + 22
    psize = PHOTO_D

    # Photo ring
    ring = 4
    draw.ellipse([cx - psize // 2 - ring, py - ring,
                  cx + psize // 2 + ring, py + psize + ring],
                 fill=bdr)
    # Inner dark ring
    draw.ellipse([cx - psize // 2 - 1, py - 1,
                  cx + psize // 2 + 1, py + psize + 1],
                 fill=(8, 12, 30))

    photo = photo_cache.get(person.id)
    if photo:
        canvas.paste(photo, (cx - psize // 2, py), photo)
    else:
        avatar = _default_avatar(psize, person.gender, dead)
        canvas.paste(avatar, (cx - psize // 2, py), avatar)

    # Deceased cross-fade overlay
    if dead:
        overlay = Image.new('RGBA', (psize, psize), (20, 20, 35, 80))
        mask = Image.new('L', (psize, psize), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, psize - 1, psize - 1], fill=255)
        canvas.paste(overlay, (cx - psize // 2, py), mask)

    # Status dot
    dot_col = (107, 114, 128) if dead else (34, 197, 94)
    dot_x = x + CARD_W - 16
    dot_y = y + 14
    draw.ellipse([dot_x, dot_y, dot_x + 8, dot_y + 8], fill=dot_col)
    # white ring
    draw.ellipse([dot_x - 1, dot_y - 1, dot_x + 9, dot_y + 9],
                 outline=(20, 25, 50), width=1)

    # ── Name ────────────────────────────────────────────────
    text_y = py + psize + 10
    fn_bold = _font(11, bold=True)
    fn_reg  = _font(10)

    last  = person.last_name or ''
    first = person.first_name or ''
    mid   = (person.middle_name or '')[:12]

    for line in [last, first, mid]:
        if not line:
            continue
        tw = _text_w(draw, line, fn_bold)
        tx = cx - tw // 2
        # shadow
        draw.text((tx + 1, text_y + 1), line, font=fn_bold, fill=(0, 0, 0, 120))
        draw.text((tx, text_y), line, font=fn_bold, fill=TEXT_NAME)
        text_y += 15

    # ── Years ───────────────────────────────────────────────
    years = ''
    if person.birth_date:
        years = str(person.birth_date.year)
    if person.death_date:
        years += f' — {person.death_date.year}'
    elif person.birth_date:
        age = (date.today() - person.birth_date).days // 365
        years += f'  ({age} yosh)'

    if years:
        fn_yr = _font(9)
        tw = _text_w(draw, years, fn_yr)
        draw.text((cx - tw // 2, y + CARD_H - 22), years,
                  font=fn_yr, fill=TEXT_YEAR)

    # ── Deceased tag ────────────────────────────────────────
    if dead:
        fn_tag = _font(8)
        tag = '🌿 Vafot etgan'
        tw = _text_w(draw, tag, fn_tag)
        draw.text((cx - tw // 2, y + CARD_H - 11), tag,
                  font=fn_tag, fill=DEAD_ACC)


# ── Connection lines ─────────────────────────────────────────────────────────
def _bezier_points(x0, y0, x1, y1, steps=20):
    """Vertical bezier curve from (x0,y0) to (x1,y1)."""
    my = (y0 + y1) / 2
    pts = []
    for i in range(steps + 1):
        t = i / steps
        # Cubic bezier: P0=(x0,y0), P1=(x0,my), P2=(x1,my), P3=(x1,y1)
        b = (1 - t)
        px = b**3 * x0 + 3 * b**2 * t * x0 + 3 * b * t**2 * x1 + t**3 * x1
        py = b**3 * y0 + 3 * b**2 * t * my + 3 * b * t**2 * my + t**3 * y1
        pts.append((px, py))
    return pts


def _draw_line(draw, x0, y0, x1, y1, color, width=2):
    pts = _bezier_points(x0, y0, x1, y1)
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=color, width=width)


# ── Layout engine ────────────────────────────────────────────────────────────
class TreeLayout:
    def __init__(self, persons):
        self.persons = {p.id: p for p in persons}
        self._build()

    def _build(self):
        all_ids = set(self.persons)

        # children_map: primary parent (father if exists, else mother) → children
        self.children_map = {pid: [] for pid in all_ids}
        for p in self.persons.values():
            if p.father_id and p.father_id in all_ids:
                self.children_map[p.father_id].append(p.id)
            elif p.mother_id and p.mother_id in all_ids:
                self.children_map[p.mother_id].append(p.id)

        for pid in self.children_map:
            self.children_map[pid].sort(key=lambda cid: (
                self.persons[cid].child_number or 99,
                self.persons[cid].birth_date or date(2100, 1, 1),
            ))

        # Spouse map: only people who share children
        self.spouse_map = {}
        for p in self.persons.values():
            f, m = p.father_id, p.mother_id
            if f and m and f in all_ids and m in all_ids:
                self.spouse_map.setdefault(f, m)
                self.spouse_map.setdefault(m, f)

        # Nodes that appear only as spouses (not primary parents)
        self.spouse_only = set()
        for pid, spid in self.spouse_map.items():
            # If pid has no children assigned to it but its spouse does
            if not self.children_map.get(pid) and self.children_map.get(spid):
                self.spouse_only.add(pid)

        # Roots: no parents in dataset AND not a "spouse only" node
        has_parent = set()
        for p in self.persons.values():
            if p.father_id and p.father_id in all_ids:
                has_parent.add(p.id)
            if p.mother_id and p.mother_id in all_ids:
                has_parent.add(p.id)

        self.roots = [pid for pid in all_ids
                      if pid not in has_parent and pid not in self.spouse_only]
        self.roots.sort(key=lambda pid: self.persons[pid].child_number or 99)

        # Generation assignment
        self.gen_map = {}
        visited = set()

        def assign_gen(pid, g):
            if pid in visited:
                return
            visited.add(pid)
            self.gen_map[pid] = g
            sp = self.spouse_map.get(pid)
            if sp and sp not in self.gen_map:
                self.gen_map[sp] = g
                visited.add(sp)
            for cid in self.children_map.get(pid, []):
                assign_gen(cid, g + 1)

        for r in self.roots:
            assign_gen(r, 0)

        for pid in all_ids:
            if pid not in self.gen_map:
                self.gen_map[pid] = 0

    def _unit_own_w(self, pid):
        """Width of the person's own card(s) — includes spouse if any."""
        sp = self.spouse_map.get(pid)
        if sp and sp in self.spouse_only:
            return 2 * CARD_W + COUPLE_GAP
        return CARD_W

    def _subtree_w(self, pid, memo=None):
        if memo is None:
            memo = {}
        if pid in memo:
            return memo[pid]
        children = [c for c in self.children_map.get(pid, []) if c not in self.spouse_only]
        if not children:
            w = self._unit_own_w(pid)
        else:
            children_total = sum(self._subtree_w(c, memo) for c in children)
            children_total += H_GAP * (len(children) - 1)
            w = max(self._unit_own_w(pid), children_total)
        memo[pid] = w
        return w

    def compute_positions(self):
        positions = {}
        memo = {}

        def place(pid, left_x):
            g = self.gen_map.get(pid, 0)
            y = PAD_Y + TITLE_H + g * (CARD_H + V_GAP)
            sp = self.spouse_map.get(pid)
            has_sp = sp and sp in self.spouse_only
            children = [c for c in self.children_map.get(pid, []) if c not in self.spouse_only]

            if not children:
                positions[pid] = (left_x, y)
                if has_sp:
                    positions[sp] = (left_x + CARD_W + COUPLE_GAP, y)
                return left_x + self._subtree_w(pid, memo)

            # Place children first to know their span
            child_centers = []
            cx_cur = left_x
            for cid in children:
                cw = self._subtree_w(cid, memo)
                child_center = cx_cur + cw / 2
                child_centers.append(child_center)
                place(cid, cx_cur)
                cx_cur += cw + H_GAP

            span_center = (child_centers[0] + child_centers[-1]) / 2

            own_w = self._unit_own_w(pid)
            px = span_center - own_w / 2
            # Don't go left of left_x
            px = max(px, left_x)
            positions[pid] = (px, y)
            if has_sp:
                positions[sp] = (px + CARD_W + COUPLE_GAP, y)

            return left_x + self._subtree_w(pid, memo)

        cur_x = PAD_X
        for r in self.roots:
            place(r, cur_x)
            cur_x += self._subtree_w(r, memo) + H_GAP * 2

        return positions


# ── Main renderer ────────────────────────────────────────────────────────────
def render_tree(persons) -> bytes:
    """Shajara daraxti rasmini PNG bytes sifatida qaytaradi."""
    if not persons:
        return None

    # 100+ kishi bo'lsa karta o'lchamini dinamik qisqartirish
    n = len(persons)
    global CARD_W, CARD_H, PHOTO_D, H_GAP, COUPLE_GAP, V_GAP, PAD_X, PAD_Y, TITLE_H
    _orig = (CARD_W, CARD_H, PHOTO_D, H_GAP, COUPLE_GAP, V_GAP, PAD_X, PAD_Y, TITLE_H)

    if n > 80:
        scale_d = 0.55
    elif n > 50:
        scale_d = 0.70
    elif n > 30:
        scale_d = 0.82
    else:
        scale_d = 1.0

    if scale_d < 1.0:
        CARD_W     = int(148 * scale_d)
        CARD_H     = int(205 * scale_d)
        PHOTO_D    = int(80  * scale_d)
        H_GAP      = int(28  * scale_d)
        COUPLE_GAP = int(10  * scale_d)
        V_GAP      = int(120 * scale_d)
        PAD_X      = int(90  * scale_d)
        PAD_Y      = int(80  * scale_d)
        TITLE_H    = int(100 * scale_d)

    try:
        layout = TreeLayout(persons)
        positions = layout.compute_positions()

        # Canvas size
        xs = [x for x, y in positions.values()]
        ys = [y for x, y in positions.values()]
        canvas_w = int(max(xs) + CARD_W + PAD_X * 2)
        canvas_h = int(max(ys) + CARD_H + PAD_Y * 2 + 40)
        canvas_w = max(canvas_w, 900)

        return _render_canvas(persons, layout, positions, canvas_w, canvas_h)
    finally:
        # Restore globals
        (CARD_W, CARD_H, PHOTO_D, H_GAP, COUPLE_GAP,
         V_GAP, PAD_X, PAD_Y, TITLE_H) = _orig


def _render_canvas(persons, layout, positions, canvas_w, canvas_h) -> bytes:
    """Asosiy render — 2x supersampling bilan yuqori sifat."""
    SCALE = 2

    # 2x kattalashtirish
    sc_pos = {pid: (x * SCALE, y * SCALE) for pid, (x, y) in positions.items()}
    sc_w, sc_h = canvas_w * SCALE, canvas_h * SCALE

    # Barcha o'lchamlarni 2x qil
    sc_card_w = CARD_W * SCALE
    sc_card_h = CARD_H * SCALE
    sc_photo  = PHOTO_D * SCALE
    sc_v_gap  = V_GAP * SCALE
    sc_pad_x  = PAD_X * SCALE
    sc_pad_y  = PAD_Y * SCALE

    # Background
    canvas = _make_background(sc_w, sc_h).convert('RGBA')
    draw = ImageDraw.Draw(canvas)

    # ── Title ───────────────────────────────────────────────────────────────
    fn_title = _font(28 * SCALE, bold=True)
    fn_sub   = _font(14 * SCALE)
    title    = "MATAYEV & ABDUMANNONOVLAR"
    subtitle = "SHAJARA DARAXTI"

    tw = _text_w(draw, title, fn_title)
    tx = (sc_w - tw) // 2
    for off in range(16, 0, -4):
        a = int(35 * (1 - off / 16))
        draw.text((tx, sc_pad_y - off), title, font=fn_title,
                  fill=(100, 120, 255, a))
    draw.text((tx, sc_pad_y), title, font=fn_title, fill=(200, 215, 255))

    sw2 = _text_w(draw, subtitle, fn_sub)
    draw.text(((sc_w - sw2) // 2, sc_pad_y + 36 * SCALE), subtitle,
              font=fn_sub, fill=(130, 150, 220))

    line_y = sc_pad_y + 58 * SCALE
    draw.line([(sc_w // 4, line_y), (sc_w * 3 // 4, line_y)],
              fill=(60, 80, 180, 180), width=SCALE)

    # ── Load photos (2x o'lchamda) ──────────────────────────────────────────
    from django.conf import settings as dj_settings
    import urllib.request, tempfile
    photo_cache = {}
    for p in persons:
        img = None
        # 1) ImageKit CDN URL dan yukla
        photo_url = getattr(p, 'photo_url', '') or ''
        if photo_url:
            try:
                with urllib.request.urlopen(photo_url, timeout=8) as resp:
                    data = resp.read()
                img = _load_circular_photo(io.BytesIO(data), sc_photo)
            except Exception:
                img = None
        # 2) Lokal MEDIA_ROOT dan yukla
        if img is None and p.photo:
            path = os.path.join(dj_settings.MEDIA_ROOT, str(p.photo))
            if os.path.exists(path):
                img = _load_circular_photo(path, sc_photo)
        if img:
            photo_cache[p.id] = img

    pmap = {p.id: p for p in persons}

    # ── Draw connection lines ────────────────────────────────────────────────
    lw = SCALE * 2   # chiziq qalinligi
    for pid, (px, py) in sc_pos.items():
        person = pmap.get(pid)
        if not person:
            continue

        # Couple line (husband ↔ wife)
        sp = layout.spouse_map.get(pid)
        if sp and sp in sc_pos and sp in layout.spouse_only:
            sx, sy = sc_pos[sp]
            lx1 = px + sc_card_w
            lx2 = sx
            ly  = py + sc_card_h // 2
            draw.line([(lx1, ly), (lx2, ly)], fill=COUPLE_LINE, width=lw)
            mx = (lx1 + lx2) // 2
            draw.rounded_rectangle([mx - 10, ly - 6, mx + 10, ly + 6],
                                    radius=4, fill=(50, 60, 100))
            fn_hrt = _font(10 * SCALE)
            draw.text((mx - 6, ly - 9 * SCALE // 2), '♥', font=fn_hrt,
                      fill=(220, 80, 120))

        # Parent → children: FAQAT otaning karta markazidan
        children = [c for c in layout.children_map.get(pid, [])
                    if c not in layout.spouse_only]
        if not children:
            continue

        parent_cx = int(px + sc_card_w // 2)
        parent_cy = int(py + sc_card_h)

        child_tops = []
        for cid in children:
            if cid in sc_pos:
                cx2, cy2 = sc_pos[cid]
                child_cx = int(cx2 + sc_card_w // 2)
                child_tops.append((child_cx, int(cy2)))

        if not child_tops:
            continue

        stem_y = parent_cy + sc_v_gap // 2

        # Vertical stem
        draw.line([(parent_cx, parent_cy), (parent_cx, stem_y)],
                  fill=LINE_COL, width=lw)

        # Horizontal bar
        bar_xs = [ct[0] for ct in child_tops]
        bar_x1, bar_x2 = min(bar_xs), max(bar_xs)
        if bar_x1 != bar_x2:
            draw.line([(bar_x1, stem_y), (bar_x2, stem_y)],
                      fill=LINE_COL, width=lw)

        # Drop lines + arrows
        aw = 6 * SCALE
        for child_cx, child_cy in child_tops:
            draw.line([(child_cx, stem_y), (child_cx, child_cy)],
                      fill=LINE_COL, width=lw)
            draw.polygon([
                (child_cx,      child_cy),
                (child_cx - aw, child_cy - aw * 2),
                (child_cx + aw, child_cy - aw * 2),
            ], fill=(100, 120, 200))

    # ── Draw cards (2x koordinatalar) ───────────────────────────────────────
    for pid, (px, py) in sc_pos.items():
        person = pmap.get(pid)
        if person:
            _draw_card_scaled(canvas, int(px), int(py), person,
                              photo_cache, SCALE, sc_card_w, sc_card_h, sc_photo)

    # ── Legend ──────────────────────────────────────────────────────────────
    leg_y = sc_h - sc_pad_y + 10 * SCALE
    fn_leg = _font(11 * SCALE)
    items = [
        ((99, 102, 241),  'Erkak'),
        ((236, 72, 153),  'Ayol'),
        ((71, 78, 98),    'Vafot etgan'),
        ((34, 197, 94),   '● Tirik'),
        ((107, 114, 128), '● Vafot'),
    ]
    lx = sc_pad_x
    for color, label in items:
        sz = 14 * SCALE
        draw.rounded_rectangle([lx, leg_y, lx + sz, leg_y + sz],
                                radius=4, fill=color)
        draw.text((lx + sz + 6, leg_y), label, font=fn_leg, fill=(160, 175, 210))
        lx += _text_w(draw, label, fn_leg) + sz + 40

    # ── Generation labels ────────────────────────────────────────────────────
    fn_gen = _font(10 * SCALE)
    gen_labels = ['I avlod', 'II avlod', 'III avlod', 'IV avlod', 'V avlod', 'VI avlod']
    done_gens = set()
    for pid, (px, py) in sc_pos.items():
        g = layout.gen_map.get(pid, 0)
        if g not in done_gens and g < len(gen_labels):
            done_gens.add(g)
            label = gen_labels[g]
            lbl_y = int(py + sc_card_h // 2 - 8 * SCALE)
            draw.text((6 * SCALE, lbl_y), label, font=fn_gen, fill=(70, 90, 160))

    # ── Downscale 2x → 1x (antialiasing) ───────────────────────────────────
    rgb = canvas.convert('RGB')
    final = rgb.resize((canvas_w, canvas_h), Image.LANCZOS)
    buf = io.BytesIO()
    final.save(buf, format='PNG', optimize=True)
    buf.seek(0)
    return buf.read()
