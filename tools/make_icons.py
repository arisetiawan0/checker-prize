#!/usr/bin/env python3
"""Generate ikon PWA Beauty Price Checker (192, 512, maskable-512)."""
import math
import struct
import zlib
import os

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "assets")


def png_chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def make_png(size, path, radius_ratio=0.24, maskable=False):
    """Ikon: latar charcoal, rounded square, lambang 'B' mirror + berkas kilau rose."""
    s = size
    px = bytearray()

    # palet
    bg_hi = (0x2B, 0x27, 0x33)
    bg_lo = (0x15, 0x13, 0x1A)
    rose = (0xC2, 0x47, 0x7E)
    rose_soft = (0xE8, 0x8F, 0xB8)
    gold = (0xFF, 0xD1, 0x66)
    white = (0xFF, 0xFF, 0xFF)

    r = s * radius_ratio
    cx = s / 2
    cy = s / 2

    def inside_rounded(x, y):
        # rounded-rect area
        rx0, ry0 = 0, 0
        rx1, ry1 = s - 1, s - 1
        qx = max(rx0 + r - x, x - (rx1 - r), 0)
        qy = max(ry0 + r - y, y - (ry1 - r), 0)
        return qx * qx + qy * qy <= r * r

    for y in range(s):
        px.append(0)  # filter none
        for x in range(s):
            if not inside_rounded(x, y):
                px += b"\x00\x00\x00\x00"
                continue
            # latar gradient diagonal
            t = (x + y) / (2 * s)
            cr = bg_hi[0] + (bg_lo[0] - bg_hi[0]) * t
            cg = bg_hi[1] + (bg_lo[1] - bg_hi[1]) * t
            cb = bg_hi[2] + (bg_lo[2] - bg_hi[2]) * t

            u = (x - cx) / s  # -0.5..0.5
            v = (y - cy) / s

            # berkas kilau rose di kanan atas
            glow = max(0.0, 1.0 - math.hypot(u - 0.30, v + 0.30) * 3.4)
            cr = cr + (rose[0] - cr) * glow * 0.55
            cg = cg + (rose[1] - cg) * glow * 0.55
            cb = cb + (rose[2] - cb) * glow * 0.55

            # lambang: huruf B bulat (dua lengkung) + titik kilau
            # koordinat lambang relatif
            lx = u * 100  # -50..50
            ly = v * 100

            stroke = 7.5
            in_b = False
            # batang vertikal B
            if -26 <= lx <= -26 + stroke and -30 <= ly <= 30:
                in_b = True
            # lengkung atas: pusat (-8, -14) radius 16
            d1 = math.hypot(lx - (-6), ly - (-15))
            # lengkung bawah: pusat (-8, 13) radius 19
            d2 = math.hypot(lx - (-6), ly - (14))
            if d1 <= 17 and d1 >= 17 - stroke and ly <= -6:
                in_b = True
            if d2 <= 20 and d2 >= 20 - stroke and ly >= -8:
                in_b = True
            # garis penghubung tengah
            if -26 <= lx <= 8 and abs(ly - (-1)) <= stroke / 2:
                in_b = True

            # titik kilau kecil (dot) kanan bawah
            ddot = math.hypot(lx - 26, ly - 24)
            dot = ddot <= 6.5

            if dot:
                cr, cg, cb = gold
            elif in_b:
                # outline putih dengan kilau rose di sisi kanan
                cr, cg, cb = white
            else:
                # ring tipis di dalam latar
                dr = math.hypot(u, v) * 100
                if 44 <= dr <= 45.4:
                    cr = min(255, cr + 14)
                    cg = min(255, cg + 12)
                    cb = min(255, cb + 14)

            if maskable:
                # amankan konten di 66% tengah (zona aman maskable)
                pass  # lambang sudah relatif kecil di tengah

            px += bytes((int(max(0, min(255, cr))), int(max(0, min(255, cg))), int(max(0, min(255, cb))), 255))

    ihdr = struct.pack(">IIBBBBB", s, s, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", zlib.compress(bytes(px), 9)) + png_chunk(b"IEND", b"")

    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, s, "x", s)


os.makedirs(OUT, exist_ok=True)
make_png(192, os.path.join(OUT, "icon-192.png"))
make_png(512, os.path.join(OUT, "icon-512.png"))
make_png(512, os.path.join(OUT, "icon-maskable-512.png"), radius_ratio=0.0, maskable=True)
