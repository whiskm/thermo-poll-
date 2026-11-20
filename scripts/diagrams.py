"""Генератор схем для content/diagrams.

Запуск: pip install iapws && python3 scripts/diagrams.py
Схемы идеального газа и p,v-диаграммы пара строятся по формулам (масштаб условный).
T,s- и h,s-диаграммы пара строятся по данным IAPWS-IF97 (библиотека iapws).
Цвета линий осей и подписей берутся из currentColor, поэтому схемы работают в светлой и темной теме.
"""
import math
import os
import sys

from iapws import IAPWS97 as W

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "content", "diagrams")

STYLE = """
.ax{stroke:currentColor;stroke-width:1.3;fill:none}
.axh{fill:currentColor}
.t{fill:currentColor;font:12px system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.tv{fill:currentColor;font:italic 13px Georgia,'Times New Roman',serif}
.ts{fill:currentColor;font:10px system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;opacity:.8}
.ref{stroke:currentColor;stroke-width:1;fill:none;stroke-dasharray:4 3;opacity:.5}
.thin{stroke:currentColor;stroke-width:1;fill:none;opacity:.55}
.dome{stroke:currentColor;stroke-width:1.8;fill:none}
.c1{stroke:#e8590c;stroke-width:2.4;fill:none}
.c2{stroke:#1c7ed6;stroke-width:2.4;fill:none}
.c3{stroke:#2f9e44;stroke-width:2.2;fill:none}
.c4{stroke:#ae3ec9;stroke-width:2;fill:none}
.f1{fill:#e8590c}.f2{fill:#1c7ed6}.f3{fill:#2f9e44}.f4{fill:#ae3ec9}
.a1{fill:#e8590c;opacity:.22}.a2{fill:#1c7ed6;opacity:.2}.a3{fill:#2f9e44;opacity:.25}.a4{fill:#ae3ec9;opacity:.2}
.pt{fill:currentColor}
"""


def fmt(v):
    return f"{v:g}"


def rich(s):
    """'T_1' -> T с нижним индексом 1. Индекс идет до конца строки."""
    if "_" not in s:
        return esc(s)
    a, b = s.split("_", 1)
    return f'{esc(a)}<tspan font-size="75%" dy="3">{esc(b)}</tspan>'


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


class Plot:
    def __init__(self, xr, yr, xlabel, ylabel, w=320, h=240, ml=28, mr=16, mt=18, mb=24):
        self.x0, self.x1 = xr
        self.y0, self.y1 = yr
        self.w, self.h, self.ml, self.mr, self.mt, self.mb = w, h, ml, mr, mt, mb
        self.xlabel, self.ylabel = xlabel, ylabel
        self.back, self.front = [], []

    def X(self, x):
        return self.ml + (x - self.x0) / (self.x1 - self.x0) * (self.w - self.ml - self.mr)

    def Y(self, y):
        return self.h - self.mb - (y - self.y0) / (self.y1 - self.y0) * (self.h - self.mt - self.mb)

    def inside(self, x, y):
        ex = (self.x1 - self.x0) * 0.001
        ey = (self.y1 - self.y0) * 0.001
        return self.x0 - ex <= x <= self.x1 + ex and self.y0 - ey <= y <= self.y1 + ey

    def _d(self, pts):
        segs, cur = [], []
        for x, y in pts:
            if self.inside(x, y):
                cur.append((x, y))
            elif cur:
                segs.append(cur)
                cur = []
        if cur:
            segs.append(cur)
        out = []
        for s in segs:
            if len(s) < 2:
                continue
            out.append("M" + " L".join(f"{self.X(x):.1f},{self.Y(y):.1f}" for x, y in s))
        return " ".join(out)

    def line(self, pts, cls, arrows=(), back=False):
        d = self._d(pts)
        if not d:
            return
        (self.back if back else self.front).append(f'<path class="{cls}" d="{d}"/>')
        for f in arrows:
            self.arrow(pts, f, cls)

    def arrow(self, pts, f, cls):
        sc = [(self.X(x), self.Y(y)) for x, y in pts if self.inside(x, y)]
        L = [0.0]
        for i in range(1, len(sc)):
            L.append(L[-1] + math.dist(sc[i - 1], sc[i]))
        target = L[-1] * f
        i = next(i for i in range(1, len(L)) if L[i] >= target)
        (xa, ya), (xb, yb) = sc[i - 1], sc[i]
        t = 0 if L[i] == L[i - 1] else (target - L[i - 1]) / (L[i] - L[i - 1])
        cx, cy = xa + (xb - xa) * t, ya + (yb - ya) * t
        ang = math.atan2(yb - ya, xb - xa)
        s = 8
        p1 = (cx + s * math.cos(ang), cy + s * math.sin(ang))
        p2 = (cx + s * 0.6 * math.cos(ang + 2.5), cy + s * 0.6 * math.sin(ang + 2.5))
        p3 = (cx + s * 0.6 * math.cos(ang - 2.5), cy + s * 0.6 * math.sin(ang - 2.5))
        fcls = {"c1": "f1", "c2": "f2", "c3": "f3", "c4": "f4"}.get(cls, "pt")
        self.front.append(f'<path class="{fcls}" d="M{p1[0]:.1f},{p1[1]:.1f} L{p2[0]:.1f},{p2[1]:.1f} L{p3[0]:.1f},{p3[1]:.1f} Z"/>')

    def poly(self, pts, cls):
        d = "M" + " L".join(f"{self.X(x):.1f},{self.Y(y):.1f}" for x, y in pts) + " Z"
        self.back.append(f'<path class="{cls}" d="{d}"/>')

    def under(self, pts, cls):
        self.poly(list(pts) + [(pts[-1][0], self.y0), (pts[0][0], self.y0)], cls)

    def left(self, pts, cls):
        self.poly(list(pts) + [(self.x0, pts[-1][1]), (self.x0, pts[0][1])], cls)

    def dot(self, x, y, label=None, dx=6, dy=-6, anchor="start"):
        self.front.append(f'<circle class="pt" cx="{self.X(x):.1f}" cy="{self.Y(y):.1f}" r="2.8"/>')
        if label:
            self.text(x, y, label, dx=dx, dy=dy, anchor=anchor)

    def text(self, x, y, s, cls="t", dx=0, dy=0, anchor="start"):
        self.front.append(f'<text class="{cls}" x="{self.X(x) + dx:.1f}" y="{self.Y(y) + dy:.1f}" text-anchor="{anchor}">{rich(s)}</text>')

    def svg(self):
        ox, oy = self.ml, self.h - self.mb
        ex, ey = self.w - 6, 6
        ax = [
            f'<path class="ax" d="M{ox},{oy} L{ex},{oy} M{ox},{oy} L{ox},{ey}"/>',
            f'<path class="axh" d="M{ex + 4},{oy} l-9,-3.5 v7 Z M{ox},{ey - 4} l-3.5,9 h7 Z"/>',
            f'<text class="tv" x="{ex - 2}" y="{oy + 16}" text-anchor="end">{rich(self.xlabel)}</text>',
            f'<text class="tv" x="{ox - 8}" y="{ey + 10}" text-anchor="end">{rich(self.ylabel)}</text>',
        ]
        body = "\n".join(self.back + ax + self.front)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" '
                f'width="{self.w}" height="{self.h}" role="img">\n<style>{STYLE}</style>\n{body}\n</svg>\n')

    def save(self, name):
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            f.write(self.svg())
        print("wrote", name)


def lin(a, b, n=200):
    return [a + (b - a) * i / (n - 1) for i in range(n)]


# ===================== Идеальный газ =====================
CV, R = 1.0, 0.4
CP, K = CV + R, (CV + R) / CV
V1, P1 = 1.0, 1.0
T1 = P1 * V1 / R


def st(v, p):
    T = p * v / R
    return T, CV * math.log(T) + R * math.log(v)


S1 = st(V1, P1)[1]


def poly_pts(n, a, b):
    """Политропа через точку 1. a,b: объемы (для изохоры давления)."""
    if n is None:
        return [(V1, p) for p in lin(a, b)]
    return [(v, P1 * (V1 / v) ** n) for v in lin(a, b)]


def to_ts(pv):
    return [st(v, p)[::-1] for v, p in pv]


REFS = [(0, "n = 0"), (1, "n = 1"), (K, "n = k"), (None, "n = ±∞")]

# где подписывать линию: (крайняя точка видимой части, dx, dy, anchor)
LAB_PV = {0: ("max_x", 0, -5, "end"), 1: ("max_x", 0, -5, "end"),
          K: ("max_x", 0, 13, "end"), None: ("max_y", 5, 8, "start")}
LAB_TS = {0: ("max_y", -4, 4, "end"), 1: ("max_x", 0, -5, "end"),
          K: ("max_y", 4, 8, "start"), None: ("min_y", 3, 14, "start")}


def label_curve(P, pts, lab, rule):
    vis = [q for q in pts if P.inside(*q)]
    if not vis:
        return
    how, dx, dy, anchor = rule
    pick = {"max_x": lambda q: q[0], "max_y": lambda q: q[1], "min_y": lambda q: -q[1]}[how]
    x, y = max(vis, key=pick)
    P.text(x, y, lab, cls="ts", dx=dx, dy=dy, anchor=anchor)


def curve_pair(n):
    pv = poly_pts(None, 0.25, 2.5) if n is None else poly_pts(n, 0.3, 2.7)
    tsp = [(S1, T) for T in lin(0.6, 5.1)] if n == K else to_ts(pv)
    return pv, tsp


def ref_lines(pp, tp, which=None, labels=True):
    for n, lab in REFS:
        if which is not None and n not in which:
            continue
        pv, tsp = curve_pair(n)
        pp.line(pv, "ref", back=True)
        tp.line(tsp, "ref", back=True)
        if labels:
            label_curve(pp, pv, lab, LAB_PV[n])
            label_curve(tp, tsp, lab, LAB_TS[n])


def poly_diagram(name, n, exp_to, cmp_to, refs=None, ref_labels=False, exp_label="2", cmp_label="2'",
                 tsr=(S1 - 1.1, S1 + 1.15)):
    pp = Plot((0, 2.8), (0, 2.6), "v", "p")
    tp = Plot(tsr, (0, 5.2), "s", "T")
    if refs is not None:
        ref_lines(pp, tp, which=refs, labels=ref_labels)
    if n is None:
        e = [(V1, p) for p in lin(P1, exp_to)]
        c = [(V1, p) for p in lin(P1, cmp_to)]
    else:
        e = poly_pts(n, V1, exp_to)
        c = poly_pts(n, V1, cmp_to)
    if n is not None:
        pp.under(e, "a1")
        pp.text((e[0][0] + e[-1][0]) / 2, min(e[0][1], e[-1][1]) * 0.4, "l", cls="tv", anchor="middle")
    et, ct = to_ts(e), to_ts(c)
    if n == K:
        et = [(S1, T) for _, T in et]
        ct = [(S1, T) for _, T in ct]
    elif et[-1][0] > et[0][0] + 1e-9:
        tp.under(et, "a1")
        tp.text((et[0][0] + et[-1][0]) / 2, min(et[0][1], et[-1][1]) * 0.4, "q", cls="tv", anchor="middle")
    pp.line(e, "c1", arrows=(0.6,))
    pp.line(c, "c2", arrows=(0.6,))
    tp.line(et, "c1", arrows=(0.6,))
    tp.line(ct, "c2", arrows=(0.6,))
    for P, E, C in ((pp, e, c), (tp, et, ct)):
        P.dot(*E[0], "1", dx=-12, dy=-4)
        P.dot(*E[-1], exp_label)
        P.dot(*C[-1], cmp_label)
    pp.save(f"{name}-pv.svg")
    tp.save(f"{name}-ts.svg")


def ideal_gas():
    poly_diagram("q23", 0, 2.0, 0.55, refs=[None])
    poly_diagram("q25", None, 1.9, 0.5, refs=[0])
    poly_diagram("q27", 1, 2.3, 0.5)
    poly_diagram("q29", K, 2.3, 0.6, refs=[1])
    poly_diagram("q34", 0, 2.0, 0.55, refs=[1, K, None], ref_labels=True)
    poly_diagram("q35", None, 1.9, 0.5, refs=[0, 1, K], ref_labels=True)
    poly_diagram("q36", 0.5, 2.2, 0.55, refs=[0, 1, K, None], ref_labels=True)
    poly_diagram("q37", 1.2, 2.3, 0.5, refs=[0, 1, K, None], ref_labels=True, tsr=(S1 - 0.45, S1 + 0.5))
    poly_diagram("q38", -1.5, 1.25, 0.8, refs=[0, 1, K, None], ref_labels=True)

    # q30: семейство политроп
    pp = Plot((0, 2.8), (0, 2.6), "v", "p")
    tp = Plot((S1 - 1.1, S1 + 1.15), (0, 5.2), "s", "T")
    iso = poly_pts(1, 1, 2.6)
    adi = poly_pts(K, 1, 2.6)
    pp.poly(iso + adi[::-1], "a4")
    iso_c = poly_pts(1, 0.42, 1)
    adi_c = poly_pts(K, 0.53, 1)
    pp.poly(iso_c + adi_c[::-1], "a4")
    pp.text(2.15, 0.62, "c_n < 0", cls="ts", anchor="middle")
    tp.poly([(S1, T1), (S1 + 1.1, T1), (S1 + 1.1, 0.7), (S1, 0.7)], "a4")
    tp.poly([(S1, T1), (S1 - 1.05, T1), (S1 - 1.05, 5.1), (S1, 5.1)], "a4")
    tp.text(S1 + 0.55, 1.6, "c_n < 0", cls="ts", anchor="middle")
    for n, lab, cls in ((0, "n = 0", "c1"), (1, "n = 1", "c3"), (K, "n = k", "c2"), (None, "n = ±∞", "c4")):
        pv, tsp = curve_pair(n)
        pp.line(pv, cls)
        tp.line(tsp, cls)
        label_curve(pp, pv, lab, LAB_PV[n])
        label_curve(tp, tsp, lab, LAB_TS[n])
    pp.dot(V1, P1, "1", dx=-12, dy=-4)
    tp.dot(S1, T1, "1", dx=-12, dy=-4)
    pp.save("q30-pv.svg")
    tp.save("q30-ts.svg")

    # q39: площади в p,v
    n = 0.5
    v2 = 1.5
    e = poly_pts(n, V1, v2)
    p2 = e[-1][1]
    T2 = p2 * v2 / R
    va = v2 * (T2 / T1) ** (1 / (K - 1))
    adi = [(v, p2 * (v2 / v) ** K) for v in lin(v2, va)]
    pa = adi[-1][1]
    isoT = [(v, R * T1 / v) for v in lin(0.55, 2.75)]
    for part in ("a", "b"):
        P = Plot((0, 2.8), (0, 1.9), "v", "p")
        P.line(isoT, "ref", back=True)
        P.text(2.75, R * T1 / 2.75, "T_1", cls="ts", dy=-6, anchor="end")
        if part == "a":
            P.under(e, "a3")
            P.under(adi, "a1")
            P.text((V1 + v2) / 2, 0.3, "l", cls="tv", anchor="middle")
            P.text((v2 + va) / 2, 0.22, "Δu", cls="tv", anchor="middle")
        else:
            P.left(e, "a3")
            P.left(adi, "a1")
            P.text(0.45, (P1 + p2) / 2 - 0.03, "l_т", cls="tv", anchor="middle")
            P.text(0.45, (p2 + pa) / 2 - 0.03, "Δh", cls="tv", anchor="middle")
        P.line(e, "c1", arrows=(0.6,))
        P.line(adi, "c2", arrows=(0.6,))
        P.dot(V1, P1, "1", dx=4, dy=-6)
        P.dot(v2, p2, "2", dx=4, dy=-6)
        P.dot(va, pa, "a", dx=4, dy=-6)
        P.text(1.95, 1.65, "1-2: n = 0,5", cls="ts", anchor="middle")
        P.text(1.95, 1.48, "2-a: адиабата", cls="ts", anchor="middle")
        P.save(f"q39-pv-{part}.svg")

    # q40: площади в T,s
    et = to_ts(e)
    s1, s2 = et[0][0], et[-1][0]
    for part, c, lab, nm, cls in (("a", CV, "Δu", "b", "c2"), ("b", CP, "Δh", "c", "c4")):
        P = Plot((s1 - 0.12, s2 + 0.1), (0, 3.6), "s", "T")
        sb = s2 - c * math.log(T2 / T1)
        aux = [(s, T2 * math.exp((s - s2) / c)) for s in lin(sb, s2)]
        P.under(et, "a2")
        P.under(aux, "a1")
        P.line([(s1 - 0.12, T1), (s2 + 0.1, T1)], "ref", back=True)
        P.text(s1 - 0.11, T1, "T_1", cls="ts", dy=-5)
        P.line(et, "c1", arrows=(0.5,))
        P.line(aux, cls)
        P.dot(s1, T1, "1", dx=-10, dy=-6)
        P.dot(s2, T2, "2", dx=4, dy=-6)
        P.dot(sb, T1, nm, dx=3, dy=14)
        P.text((sb + s2) / 2, 1.2, lab, cls="tv", anchor="middle")
        P.text((s1 + sb) / 2, 0.55, "l_т" if part == "b" else "l", cls="tv", anchor="middle")
        P.text(s1 + 0.02, 3.42, "q: вся площадь под 1-2", cls="ts")
        P.text(s1 + 0.02, 3.2, f"{lab}: под {'изохорой' if part == 'a' else 'изобарой'} {nm}-2", cls="ts")
        P.save(f"q40-ts-{part}.svg")


# ===================== p,t-диаграмма воды =====================
def phase_pt():
    P = Plot((0, 1), (0, 1), "t", "p")
    tp = (0.32, 0.18)
    k = (0.88, 0.82)
    sub = [(0.03 + (tp[0] - 0.03) * u, 0.01 + (tp[1] - 0.01) * u ** 2.2) for u in lin(0, 1)]
    vap = [(tp[0] + (k[0] - tp[0]) * u, tp[1] + (k[1] - tp[1]) * u ** 1.8) for u in lin(0, 1)]
    melt = [(tp[0] - 0.05 * u, tp[1] + (0.97 - tp[1]) * u) for u in lin(0, 1)]
    P.line(sub, "dome")
    P.line(vap, "dome")
    P.line(melt, "dome")
    P.dot(*tp, "ТТ", dx=6, dy=10)
    P.dot(*k, "K", dx=-4, dy=-8, anchor="end")
    P.text(0.13, 0.62, "Лед", anchor="middle")
    P.text(0.55, 0.72, "Вода", anchor="middle")
    P.text(0.82, 0.12, "Пар", anchor="middle")
    P.text(0.22, 0.02, "сублимация", cls="ts")
    P.text(0.6, 0.35, "парообразование", cls="ts", dx=8, dy=12)
    P.text(0.27, 0.86, "плавление", cls="ts", anchor="end", dx=-4)
    P.save("q45-pt.svg")


# ===================== Пар: схематичная p,v =====================
def dome_l(t):
    return 0.3 + 0.7 * t ** 4, 1 - (1 - t) ** 2


def dome_r(t):
    w = 1 - t
    return 1 + 1.5 * w + 2.7 * w ** 3, 1 - w ** 2


def vr_at(p):
    w = math.sqrt(1 - p)
    return 1 + 1.5 * w + 2.7 * w ** 3


def vl_at(p):
    t = 1 - math.sqrt(1 - p)
    return 0.3 + 0.7 * t ** 4


def pv_dome(P, xlines=False, labels=True):
    ts_ = lin(0.12, 1, 120)
    P.line([dome_l(t) for t in ts_], "dome")
    P.line([dome_r(t) for t in ts_], "dome")
    P.dot(1, 1, "K", dx=0, dy=-7, anchor="middle")
    if xlines:
        for x in (0.2, 0.4, 0.6, 0.8):
            pts = [(vl_at(p) + x * (vr_at(p) - vl_at(p)), p) for p in lin(0.09, 0.995)]
            P.line(pts, "ref", back=True)
    if labels:
        P.text(*dome_l(0.25), "x = 0", cls="ts", dx=4, dy=-2)
        P.text(*dome_r(0.45), "x = 1", cls="ts", dx=6, dy=-2)


def pv_iso(P, p0, vmax=5.6, cls="thin"):
    vl, vr = vl_at(p0), vr_at(p0)
    liq = [(vl - 0.03 * (p - p0), p) for p in lin(min(p0 + 0.6, 1.4), p0)]
    sup = [(v, p0 * vr / v) for v in lin(vr, vmax)]
    P.line(liq + [(vr, p0)] + sup, cls)


def steam_pv():
    P = Plot((0, 5.8), (0, 1.35), "v", "p")
    pv_dome(P, xlines=True)
    for p0, lab, dy in ((0.3, "T_1", 12), (0.8, "T_2", -4)):
        pv_iso(P, p0)
        P.text(5.6, p0 * vr_at(p0) / 5.6, lab, cls="ts", dy=dy, anchor="end")
    P.text(0.42, 1.15, "вода", cls="ts")
    P.text(2.2, 0.25, "влажный пар", cls="ts", anchor="middle")
    P.text(4.6, 0.95, "перегретый пар", cls="ts", anchor="middle")
    P.save("q49-pv.svg")

    # q52 изобара
    P = Plot((0, 5.8), (0, 1.35), "v", "p")
    pv_dome(P)
    p0 = 0.55
    v1 = vl_at(p0) + 0.3 * (vr_at(p0) - vl_at(p0))
    e = [(v, p0) for v in lin(v1, 4.9)]
    P.under(e, "a1")
    P.line(e, "c1", arrows=(0.75,))
    P.dot(v1, p0, "1", dy=-6)
    P.dot(4.9, p0, "2", dy=-6)
    P.text(3.1, 0.25, "l", cls="tv", anchor="middle")
    P.save("q52-pv.svg")

    # q53 изохора
    P = Plot((0, 5.8), (0, 1.35), "v", "p")
    pv_dome(P)
    v0 = 2.3
    e = [(v0, p) for p in lin(0.3, 0.95)]
    P.line(e, "c1", arrows=(0.5,))
    P.dot(v0, 0.3, "1", dx=6, dy=4)
    P.dot(v0, 0.95, "2", dx=6)
    P.save("q53-pv.svg")

    # q54 изотерма
    P = Plot((0, 5.8), (0, 1.35), "v", "p")
    pv_dome(P)
    p0 = 0.6
    vr = vr_at(p0)
    v1 = vl_at(p0) + 0.3 * (vr - vl_at(p0))
    e = [(v, p0) for v in lin(v1, vr, 40)] + [(v, p0 * vr / v) for v in lin(vr, 5.3)]
    P.under(e, "a1")
    P.line(e, "c1", arrows=(0.4, 0.85))
    P.dot(v1, p0, "1", dy=-6)
    P.dot(*e[-1], "2", dy=-6)
    P.text(3.2, 0.2, "l", cls="tv", anchor="middle")
    P.save("q54-pv.svg")

    # q55 адиабата (условный показатель, чтобы линия вошла в область влажного пара)
    P = Plot((0, 5.8), (0, 1.35), "v", "p")
    pv_dome(P)
    v1, p1, kk = 1.7, 0.9, 1.8
    e = [(v, p1 * (v1 / v) ** kk) for v in lin(v1, v1 * (p1 / 0.2) ** (1 / kk))]
    P.under(e, "a1")
    P.line(e, "c1", arrows=(0.55,))
    P.dot(v1, p1, "1", dx=6, dy=-4)
    P.dot(*e[-1], "2", dy=-6)
    P.text(2.8, 0.12, "l", cls="tv", anchor="middle")
    P.save("q55-pv.svg")

    # q56 пар во влажном воздухе
    P = Plot((0, 5.8), (0, 1.35), "v", "p")
    pv_dome(P)
    p0 = 0.35
    vr = vr_at(p0)
    a = (5.0, p0)
    e = [(v, p0) for v in lin(a[0], vr)]
    P.line(e, "c2", arrows=(0.5,))
    c = (vl_at(0.3) + 0.6 * (vr_at(0.3) - vl_at(0.3)), 0.3)
    P.line([(vr, p0), (vr - 0.15, 0.33), c], "c2")
    P.dot(*a, "A", dy=-6)
    P.dot(vr, p0, "P", dx=4, dy=-7)
    P.dot(*c, "C", dx=-4, dy=14, anchor="end")
    P.text(4.5, p0, "p_п = const", cls="ts", dy=14, anchor="middle")
    P.text(5.7, 1.27, "A: ненасыщенный", cls="ts", anchor="end")
    P.text(5.7, 1.17, "P: насыщенный (точка росы)", cls="ts", anchor="end")
    P.text(5.7, 1.07, "C: перенасыщенный", cls="ts", anchor="end")
    P.save("q56-pv.svg")


# ===================== Пар: T,s и h,s по IAPWS-IF97 =====================
TK = 647.096


def sat_lines(n=160):
    Ts = [273.16 + (TK - 0.05 - 273.16) * (i / (n - 1)) ** 0.7 for i in range(n)]
    liq = [W(T=T, x=0) for T in Ts]
    vap = [W(T=T, x=1) for T in Ts]
    return liq, vap


LIQ, VAP = None, None


def ts_base(P, labels=True):
    P.line([(w.s, w.T) for w in LIQ] + [(w.s, w.T) for w in VAP[::-1]], "dome")
    P.dot(W(T=TK - 0.05, x=0).s * 0.5 + W(T=TK - 0.05, x=1).s * 0.5, TK, "K", dy=-7, anchor="middle")
    if labels:
        P.text(LIQ[60].s, LIQ[60].T, "x = 0", cls="ts", dx=-4, anchor="end")
        P.text(VAP[60].s, VAP[60].T, "x = 1", cls="ts", dx=6)


def hs_base(P, labels=True):
    P.line([(w.s, w.h) for w in LIQ] + [(w.s, w.h) for w in VAP[::-1]], "dome")
    P.dot(W(T=TK - 0.05, x=0).s * 0.5 + W(T=TK - 0.05, x=1).s * 0.5, W(T=TK - 0.05, x=0).h, "K", dx=-6, dy=-4, anchor="end")
    if labels:
        P.text(VAP[30].s, VAP[30].h, "x = 1", cls="ts", dx=4, dy=14)


def isobar(p, smin, smax, n=160):
    """Изобара по s: вода, влажный пар, перегрев."""
    out = []
    for s in lin(smin, smax, n):
        try:
            w = W(P=p, s=s)
            out.append(w)
        except Exception:
            pass
    return out


def steam_ts_hs():
    global LIQ, VAP
    LIQ, VAP = sat_lines()
    TS = dict(xr=(0, 9.6), yr=(260, 760), xlabel="s", ylabel="T")
    HS = dict(xr=(1.0, 9.4), yr=(300, 3800), xlabel="s", ylabel="h")

    # q50: T,s
    P = Plot(**TS)
    ts_base(P)
    for p in (0.1, 1.0, 10.0):
        ib = isobar(p, 0.5, 9.4)
        pts = [(w.s, w.T) for w in ib]
        P.line(pts, "thin")
        x, y = [q for q in pts if P.inside(*q)][-1]
        P.text(x, y, fmt(p).replace(".", ","), cls="ts", dx=-3, dy=10, anchor="end")
    P.text(0.3, 735, "изобары, МПа", cls="ts")
    for x in (0.2, 0.4, 0.6, 0.8):
        pts = [(l.s + x * (v.s - l.s), l.T) for l, v in zip(LIQ, VAP)]
        P.line(pts, "ref", back=True)
    P.text(0.3, 560, "вода", cls="ts")
    P.text(4.6, 330, "влажный пар", cls="ts", anchor="middle")
    P.text(8.3, 560, "перегретый пар", cls="ts", anchor="middle")
    P.save("q50-ts.svg")

    # q51: h,s
    P = Plot(**HS)
    hs_base(P)
    for x in (0.8, 0.9):
        pts = [(l.s + x * (v.s - l.s), l.h + x * (v.h - l.h)) for l, v in zip(LIQ, VAP)]
        P.line(pts, "ref", back=True)
        P.text(*pts[0], f"x = {fmt(x)}".replace(".", ","), cls="ts", dy=12, anchor="middle")
    for p in (0.01, 0.1, 1.0, 10.0):
        ib = isobar(p, 1.0, 9.3)
        pts = [(w.s, w.h) for w in ib]
        P.line(pts, "thin")
        x, y = [q for q in pts if P.inside(*q)][-1]
        P.text(x, y, fmt(p).replace(".", ","), cls="ts", dx=-3, dy=10 if y > 3700 else 12, anchor="end")
    P.text(1.2, 3600, "изобары, МПа", cls="ts")
    P.text(1.2, 3380, "изотермы, °C", cls="ts")
    for t in (300, 500):
        pts = []
        psat = W(T=t + 273.15, x=1).P if t + 273.15 < TK else 30.0
        for i in range(120):
            p = psat * 0.999 * (0.003 / psat) ** (i / 119)
            w = W(P=p, T=t + 273.15)
            pts.append((w.s, w.h))
        P.line(pts, "c3")
        x, y = min(pts, key=lambda q: abs(q[0] - 7.6))
        P.text(x, y, f"{t}", cls="ts", dy=12, anchor="middle")
    # адиабатное расширение в турбине
    a = W(P=10, T=773.15)
    b = W(P=0.01, s=a.s)
    P.line([(a.s, a.h), (b.s, b.h)], "c1", arrows=(0.5,))
    P.dot(a.s, a.h, "1", dx=-10)
    P.dot(b.s, b.h, "2", dx=-10)
    P.save("q51-hs.svg")

    # процессы 52-55
    def proc(name, states, area_ts=True):
        P = Plot(**TS)
        ts_base(P, labels=False)
        pts = [(w.s, w.T) for w in states]
        if area_ts and pts[-1][0] - pts[0][0] > 0.05:
            P.under(pts, "a1")
            P.text((pts[0][0] + pts[-1][0]) / 2, 300, "q", cls="tv", anchor="middle")
        P.line(pts, "c1", arrows=(0.55,))
        P.dot(*pts[0], "1", dx=-10)
        P.dot(*pts[-1], "2", dx=6)
        P.save(f"{name}-ts.svg")
        P = Plot(**HS)
        hs_base(P, labels=False)
        pts = [(w.s, w.h) for w in states]
        P.line(pts, "c1", arrows=(0.55,))
        P.dot(*pts[0], "1", dx=-10)
        P.dot(*pts[-1], "2", dx=6)
        P.save(f"{name}-hs.svg")

    # 52: изобара 1 МПа от x = 0,3 до 350 °C
    a = W(P=1.0, x=0.3)
    b = W(P=1.0, T=623.15)
    proc("q52", [W(P=1.0, s=s) for s in lin(a.s, b.s, 120)])

    # 53: изохора v = 0,15 м3/кг от 120 °C до 350 °C
    vv = 0.15
    sts = []
    for T in lin(393.15, 623.15, 120):
        sat = W(T=T, x=1) if T < TK else None
        if sat is not None and sat.v > vv:
            wl = W(T=T, x=0)
            x = (vv - wl.v) / (sat.v - wl.v)
            sts.append(W(T=T, x=x))
        else:
            lo, hi = 0.001, 22.0
            for _ in range(60):
                mid = (lo + hi) / 2
                if W(P=mid, T=T).v > vv:
                    lo = mid
                else:
                    hi = mid
            sts.append(W(P=(lo + hi) / 2, T=T))
    proc("q53", sts)

    # 54: изотерма 200 °C от x = 0,3 до 0,3 МПа
    T = 473.15
    a = W(T=T, x=0.3)
    psat = W(T=T, x=1).P
    sts = [W(T=T, x=x) for x in lin(0.3, 1.0, 60)]
    sts += [W(P=p, T=T) for p in lin(psat * 0.999, 0.3, 60)]
    proc("q54", sts)

    # 55: адиабата от 3 МПа, 400 °C до 0,02 МПа
    a = W(P=3.0, T=673.15)
    sts = [W(P=p, s=a.s) for p in [3.0 * (0.02 / 3.0) ** (i / 59) for i in range(60)]]
    proc("q55", sts, area_ts=False)


# ===================== Влажный воздух: H,d =====================
B = 99300.0  # 745 мм рт. ст.


def ps(t):
    return 610.94 * math.exp(17.625 * t / (t + 243.04))


def d_of(t, phi):
    p = phi * ps(t)
    return 622 * p / (B - p)


def H_of(t, d):
    return 1.005 * t + d * (2501 + 1.86 * t) / 1000


def Yc(H, d):
    return H - 2.501 * d


def t_of_H(H, d):
    return (H - 2.501 * d) / (1.005 + 1.86 * d / 1000)


def hd_plot():
    return Plot((0, 30), (-12, 62), "d", "H", w=340, h=270, ml=30, mr=16)


def hd_base(P, phis=(0.2, 0.4, 0.6, 0.8), isotherms=range(-10, 51, 10), fog=False, hlines=True):
    if hlines:
        for H in range(0, 101, 20):
            pts = [(d, Yc(H, d)) for d in lin(0, 30, 40)]
            P.line(pts, "ref", back=True)
            vis = [q for q in pts if P.inside(*q)]
            if vis:
                x, y = vis[0]
                top = y > P.y1 - 1
                P.text(x, y, f"H={H}", cls="ts", dx=3, dy=10 if top else -3)
    for t in isotherms:
        dmax = min(30, d_of(t, 1.0))
        pts = [(d, Yc(H_of(t, d), d)) for d in lin(0, dmax, 30)]
        P.line(pts, "thin")
        P.text(0, pts[0][1], f"{t}", cls="ts", dx=-3, dy=3, anchor="end")
        if fog and dmax < 30:
            ds = dmax
            fpts = [(d, 1.005 * t + 1.86 * t * ds / 1000 + 2.501 * (ds - d) + 4.19 * t * (d - ds) / 1000) for d in lin(ds, 30, 20)]
            P.line(fpts, "thin")
    for phi in phis:
        pts = [(d_of(t, phi), Yc(H_of(t, d_of(t, phi)), d_of(t, phi))) for t in lin(-10, 70, 200)]
        P.line(pts, "ref")
        vis = [q for q in pts if P.inside(*q)]
        x, y = vis[-1]
        P.text(x, y, f"{int(phi * 100)}%", cls="ts", dx=-2, dy=-3, anchor="end")
    sat = [(d_of(t, 1), Yc(H_of(t, d_of(t, 1)), d_of(t, 1))) for t in lin(-10, 40, 200)]
    P.line(sat, "dome")
    vis = [q for q in sat if P.inside(*q)]
    P.text(*vis[-1], "φ = 100%", cls="ts", dx=-4, dy=14, anchor="end")
    P.text(0, 57, "t, °C", cls="ts", dx=-3, anchor="end")


def hd_point(t, phi):
    d = d_of(t, phi)
    return d, Yc(H_of(t, d), d)


def humid_air():
    # q59 точка росы
    P = hd_plot()
    hd_base(P)
    t, phi = 25, 0.5
    d, y = hd_point(t, phi)
    tr = next(tt for tt in [x / 100 for x in range(-1000, 4000)] if d_of(tt, 1) >= d)
    yr = Yc(H_of(tr, d), d)
    P.line([(d, y), (d, yr)], "c2", arrows=(0.55,))
    P.line([(d, -12), (d, yr)], "ref")
    P.line([(0, Yc(H_of(tr, 0), 0)), (d, yr)], "c3")
    P.dot(d, y, "A", dx=6)
    P.dot(d, yr, "P", dx=6, dy=12)
    P.text(0.3, Yc(H_of(tr, 0), 0), "t_р", cls="tv", dy=-5)
    P.text(d, -12, "d = const", cls="ts", dx=4, dy=-4)
    P.save("q59-hd.svg")

    # q61 ненасыщенный воздух
    P = hd_plot()
    hd_base(P)
    t, phi = 30, 0.4
    d, y = hd_point(t, phi)
    H = H_of(t, d)
    tr = next(tt for tt in [x / 100 for x in range(-1000, 4000)] if d_of(tt, 1) >= d)
    yr = Yc(H_of(tr, d), d)
    # смоченный термометр: H = const до насыщения
    tm = next(tt for tt in [x / 100 for x in range(-1000, 4000)] if H_of(tt, d_of(tt, 1)) >= H)
    dm = d_of(tm, 1)
    P.line([(d, y), (d, yr)], "c2", arrows=(0.55,))
    P.line([(d, y), (dm, Yc(H, dm))], "c1", arrows=(0.55,))
    P.line([(d, -12), (d, yr)], "ref")
    P.dot(d, y, "A", dx=-6, dy=-6, anchor="end")
    P.dot(d, yr, "P", dx=6, dy=12)
    P.dot(dm, Yc(H, dm), "M", dx=6, dy=10)
    P.text(d, -12, "d", cls="tv", dx=4, dy=-4)
    P.text(29.5, 6, "P: точка росы", cls="ts", anchor="end")
    P.text(29.5, -1, "M: смоченный термометр", cls="ts", anchor="end")
    P.save("q61-hd.svg")

    # q62 перенасыщенный воздух
    P = hd_plot()
    hd_base(P, isotherms=range(-10, 61, 10), fog=True)
    t = 20
    dn = d_of(t, 1)
    dF = dn + 8
    yF = 1.005 * t + 1.86 * t * dn / 1000 + 2.501 * (dn - dF) + 4.19 * t * (dF - dn) / 1000
    yN = Yc(H_of(t, dn), dn)
    P.line([(dn, yN), (dF, yF)], "c1")
    P.line([(dn, -12), (dn, yN)], "ref")
    P.line([(dF, -12), (dF, yF)], "ref")
    P.dot(dn, yN, "N", dx=-4, dy=-6, anchor="end")
    P.dot(dF, yF, "F", dx=6)
    P.text(dn, -12, "d_н", cls="tv", dx=-3, dy=-4, anchor="end")
    P.text(dF, -12, "d", cls="tv", dx=4, dy=-4)
    P.text(27, 12, "туман", cls="t", anchor="middle")
    P.save("q62-hd.svg")

    # q63 процессы
    P = hd_plot()
    hd_base(P, phis=(0.2, 0.6))
    d0, y0 = hd_point(5, 0.6)
    H1 = H_of(50, d0)
    y1 = Yc(H1, d0)
    d2 = 12
    y2 = Yc(H1, d2)
    d2r, H2r = 10.5, H1 - 9
    y2r = Yc(H2r, d2r)
    P.line([(d0, y0), (d0, y1)], "c1", arrows=(0.5,))
    P.line([(d0, y1), (d2, y2)], "c3", arrows=(0.5,))
    P.line([(d0, y1), (d2r, y2r)], "c4", arrows=(0.5,))
    P.dot(d0, y0, "0", dx=-6, dy=4, anchor="end")
    P.dot(d0, y1, "1", dx=-6, anchor="end")
    P.dot(d2, y2, "2", dx=6)
    P.dot(d2r, y2r, "2'", dx=-4, dy=12, anchor="end")
    # охлаждение
    dA, yA = hd_point(30, 0.75)
    tr = next(tt for tt in [x / 100 for x in range(-1000, 4000)] if d_of(tt, 1) >= dA)
    yP = Yc(H_of(tr, dA), dA)
    satp = [(d_of(tt, 1), Yc(H_of(tt, d_of(tt, 1)), d_of(tt, 1))) for tt in lin(tr, 15, 40)]
    P.line([(dA, yA), (dA, yP)], "c2", arrows=(0.5,))
    P.line(satp, "c2", arrows=(0.6,))
    P.dot(dA, yA, "A", dx=6)
    P.dot(dA, yP, "P", dx=6, dy=10)
    P.dot(*satp[-1], "C", dx=6, dy=12)
    P.save("q63-hd.svg")


# ===================== Циклы =====================
def cycles():
    # q65 p,v: цикл Карно на идеальном газе
    Ta, Tb = 3.0, 2.0
    v1, v2 = 1.0, 1.6
    r = (Ta / Tb) ** (1 / (K - 1))
    v3, v4 = v2 * r, v1 * r
    iso1 = [(v, R * Ta / v) for v in lin(v1, v2)]
    ad1 = [(v, R * Ta / v2 * (v2 / v) ** K) for v in lin(v2, v3)]
    iso2 = [(v, R * Tb / v) for v in lin(v3, v4)]
    ad2 = [(v, R * Tb / v4 * (v4 / v) ** K) for v in lin(v4, v1)]
    P = Plot((0, 4.8), (0, 1.35), "v", "p")
    P.poly(iso1 + ad1 + iso2 + ad2, "a3")
    P.line(iso1, "c1", arrows=(0.5,))
    P.line(ad1, "thin", arrows=(0.5,))
    P.line(iso2, "c2", arrows=(0.5,))
    P.line(ad2, "thin", arrows=(0.5,))
    for (x, y), lab, dx, dy in (((v1, R * Ta / v1), "1", -10, -4), ((v2, R * Ta / v2), "2", 6, -4),
                                ((v3, R * Tb / v3), "3", 6, 4), ((v4, R * Tb / v4), "4", -10, 12)):
        P.dot(x, y, lab, dx=dx, dy=dy)
    P.text(1.3, 1.02, "q_1", cls="tv", dx=6)
    P.text(3.1, 0.2, "q_2", cls="tv", anchor="middle")
    P.text(2.3, 0.5, "l_ц", cls="tv", anchor="middle")
    P.save("q65-pv.svg")

    # q65 T,s
    s1, s2 = 1.0, 2.2
    P = Plot((0.4, 2.8), (0, 3.6), "s", "T")
    P.poly([(s1, Tb), (s2, Tb), (s2, 0), (s1, 0)], "a2")
    P.poly([(s1, Ta), (s2, Ta), (s2, Tb), (s1, Tb)], "a3")
    P.line([(s1, Ta), (s2, Ta)], "c1", arrows=(0.5,))
    P.line([(s2, Ta), (s2, Tb)], "thin", arrows=(0.5,))
    P.line([(s2, Tb), (s1, Tb)], "c2", arrows=(0.5,))
    P.line([(s1, Tb), (s1, Ta)], "thin", arrows=(0.5,))
    P.dot(s1, Ta, "1", dx=-10)
    P.dot(s2, Ta, "2", dx=6)
    P.dot(s2, Tb, "3", dx=6, dy=12)
    P.dot(s1, Tb, "4", dx=-10, dy=12)
    P.text((s1 + s2) / 2, (Ta + Tb) / 2, "l_ц", cls="tv", dy=4, anchor="middle")
    P.text((s1 + s2) / 2, Tb / 2, "q_2", cls="tv", anchor="middle")
    P.text((s1 + s2) / 2, Ta, "q_1", cls="tv", dy=-6, anchor="middle")
    P.text(0.45, Ta, "T_1", cls="ts", dy=4)
    P.text(0.45, Tb, "T_2", cls="ts", dy=4)
    P.save("q65-ts.svg")

    # q66 эквивалентный цикл Карно
    P = Plot((0.4, 2.8), (0, 4.0), "s", "T")
    cs, cT, a, b = 1.5, 2.3, 0.7, 1.0
    up = [(cs + a * math.cos(u), cT + b * math.sin(u)) for u in lin(math.pi, 0, 120)]
    lo = [(cs + a * math.cos(u), cT + b * math.sin(u)) for u in lin(0, -math.pi, 120)]
    T1m = cT + b * math.pi / 4
    T2m = cT - b * math.pi / 4
    P.poly(up + lo, "a3")
    P.line(up, "c1", arrows=(0.5,))
    P.line(lo, "c2", arrows=(0.5,))
    rect = [(cs - a, T1m), (cs + a, T1m), (cs + a, T2m), (cs - a, T2m), (cs - a, T1m)]
    P.line(rect, "c4")
    P.text(cs + a, T1m, "T_1m", cls="ts", dx=5, dy=4)
    P.text(cs + a, T2m, "T_2m", cls="ts", dx=5, dy=4)
    P.text(cs, cT + b, "подвод q_1", cls="ts", dy=-6, anchor="middle")
    P.text(cs, cT - b, "отвод q_2", cls="ts", dy=14, anchor="middle")
    P.dot(cs - a, cT, "a", dx=-10)
    P.dot(cs + a, cT, "b", dx=6, dy=12)
    P.save("q66-ts.svg")

    # q67 обратный цикл Карно
    P = Plot((0.4, 2.8), (0, 3.6), "s", "T")
    P.poly([(s1, Tb), (s2, Tb), (s2, 0), (s1, 0)], "a2")
    P.poly([(s1, Ta), (s2, Ta), (s2, Tb), (s1, Tb)], "a3")
    P.line([(s1, Tb), (s2, Tb)], "c2", arrows=(0.5,))
    P.line([(s2, Tb), (s2, Ta)], "thin", arrows=(0.5,))
    P.line([(s2, Ta), (s1, Ta)], "c1", arrows=(0.5,))
    P.line([(s1, Ta), (s1, Tb)], "thin", arrows=(0.5,))
    P.dot(s1, Tb, "1", dx=-10, dy=12)
    P.dot(s2, Tb, "2", dx=6, dy=12)
    P.dot(s2, Ta, "3", dx=6)
    P.dot(s1, Ta, "4", dx=-10)
    P.text((s1 + s2) / 2, (Ta + Tb) / 2, "l_ц", cls="tv", dy=4, anchor="middle")
    P.text((s1 + s2) / 2, Tb / 2, "q_2 от холодного", cls="ts", anchor="middle")
    P.text((s1 + s2) / 2, Ta, "q_1 горячему", cls="ts", dy=-7, anchor="middle")
    P.text(0.45, Ta, "T_1", cls="ts", dy=4)
    P.text(0.45, Tb, "T_2", cls="ts", dy=4)
    P.save("q67-ts.svg")

    # q68 обобщенный цикл Карно (изохоры)
    P = Plot((0.2, 3.0), (0, 3.6), "s", "T")
    Ta, Tb = 3.0, 1.6
    sl, ds_ = 0.6, 1.0
    left = [(sl + CV * math.log(T / Tb), T) for T in lin(Tb, Ta)]
    right = [(sl + ds_ + CV * math.log(T / Tb), T) for T in lin(Ta, Tb)]
    P.under(right[::-1], "a4")
    P.under(left, "a4")
    P.line([left[-1], right[0]], "c1", arrows=(0.5,))
    P.line(right, "thin", arrows=(0.5,))
    P.line([right[-1], left[0]], "c2", arrows=(0.5,))
    P.line(left, "thin", arrows=(0.5,))
    P.dot(*left[-1], "1", dx=-10)
    P.dot(*right[0], "2", dx=6)
    P.dot(*right[-1], "3", dx=6, dy=12)
    P.dot(*left[0], "4", dx=-10, dy=12)
    P.text((left[-1][0] + right[0][0]) / 2, Ta, "q_1 при T_1", cls="ts", dy=-7, anchor="middle")
    P.text((left[0][0] + right[-1][0]) / 2, Tb, "q_2 при T_2", cls="ts", dy=14, anchor="middle")
    P.text(right[-1][0] + 0.15, 0.8, "регенерация", cls="ts")
    P.text(right[-1][0] + 0.15, 0.55, "2-3 → 4-1", cls="ts")
    P.save("q68-ts.svg")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    ideal_gas()
    phase_pt()
    steam_pv()
    steam_ts_hs()
    humid_air()
    cycles()
