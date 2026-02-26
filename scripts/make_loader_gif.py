#!/usr/bin/env python3
import re
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVG_PATH = ROOT / 'client' / 'public' / 'P_logo.svg'
OUT_PATH = ROOT / 'client' / 'public' / 'polycopy-loader.gif'

W = 240
H = 240
FRAMES = 25
DELAY_CS = 4  # 40ms

# Palette indices:
# 0 bg, 1 dim, 2 blue active, 3 white glow
PALETTE = [
    (3, 9, 22),
    (66, 84, 121),
    (58, 130, 246),
    (255, 255, 255),
]


def cubic(p0, p1, p2, p3, t):
    mt = 1.0 - t
    return (
        mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
        mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
    )


def parse_svg_paths(svg_text):
    path_ds = re.findall(r'<path[^>]*d="([^"]+)"', svg_text)
    paths = []
    for d in path_ds:
        toks = re.findall(r'[MLCZmlcz]|-?\d*\.?\d+(?:e[-+]?\d+)?', d)
        i = 0
        cmd = None
        cur = (0.0, 0.0)
        pts = []
        while i < len(toks):
            t = toks[i]
            if re.fullmatch(r'[MLCZmlcz]', t):
                cmd = t
                i += 1
                if cmd in ('Z', 'z'):
                    break
                continue

            if cmd in ('M', 'L'):
                x = float(toks[i]); y = float(toks[i + 1]); i += 2
                cur = (x, y)
                pts.append(cur)
                if cmd == 'M':
                    cmd = 'L'
            elif cmd == 'C':
                x1 = float(toks[i]); y1 = float(toks[i + 1])
                x2 = float(toks[i + 2]); y2 = float(toks[i + 3])
                x3 = float(toks[i + 4]); y3 = float(toks[i + 5]); i += 6
                p0 = cur
                p1 = (x1, y1)
                p2 = (x2, y2)
                p3 = (x3, y3)
                steps = 18
                for s in range(1, steps + 1):
                    pts.append(cubic(p0, p1, p2, p3, s / steps))
                cur = p3
            else:
                i += 1
        if len(pts) >= 3:
            paths.append(pts)
    return paths


def transform_paths(paths):
    s = min((W * 0.70) / 146.0, (H * 0.86) / 198.0)
    ox = W * 0.5 - (146.0 * s) * 0.5
    oy = H * 0.5 - (198.0 * s) * 0.5
    return [[(x * s + ox, y * s + oy) for x, y in poly] for poly in paths]


def rotate_point(x, y, cx, cy, a):
    sa = math.sin(a)
    ca = math.cos(a)
    dx, dy = x - cx, y - cy
    return (cx + dx * ca - dy * sa, cy + dx * sa + dy * ca)


def rotate_poly(poly, angle, cx, cy):
    return [rotate_point(x, y, cx, cy, angle) for x, y in poly]


def fill_polygon(buf, poly, color_idx):
    ys = [p[1] for p in poly]
    y_min = max(0, int(math.floor(min(ys))))
    y_max = min(H - 1, int(math.ceil(max(ys))))
    n = len(poly)
    for y in range(y_min, y_max + 1):
        scan_y = y + 0.5
        xs = []
        for i in range(n):
            x1, y1 = poly[i]
            x2, y2 = poly[(i + 1) % n]
            if y1 == y2:
                continue
            if (y1 <= scan_y < y2) or (y2 <= scan_y < y1):
                t = (scan_y - y1) / (y2 - y1)
                xs.append(x1 + t * (x2 - x1))
        xs.sort()
        for j in range(0, len(xs) - 1, 2):
            x_start = max(0, int(math.ceil(xs[j])))
            x_end = min(W - 1, int(math.floor(xs[j + 1])))
            if x_end >= x_start:
                row = y * W
                for x in range(x_start, x_end + 1):
                    buf[row + x] = color_idx


def build_frame(paths, frame_idx):
    # solid background
    buf = [0] * (W * H)

    cx, cy = W * 0.5, H * 0.5
    angle = (2 * math.pi * frame_idx) / FRAMES * 0.10
    active = int((frame_idx / FRAMES) * len(paths)) % len(paths)
    prev = (active - 1) % len(paths)

    for i, poly in enumerate(paths):
        color = 1
        if i == active:
            color = 2
        elif i == prev:
            color = 3
        rot_poly = rotate_poly(poly, angle, cx, cy)
        fill_polygon(buf, rot_poly, color)

    return buf


def lzw_compress(min_code_size, indices):
    clear = 1 << min_code_size
    end = clear + 1

    table = {bytes([i]): i for i in range(clear)}
    next_code = end + 1
    code_size = min_code_size + 1

    out = bytearray()
    cur = 0
    bits = 0

    def emit(code):
        nonlocal cur, bits
        cur |= (code << bits)
        bits += code_size
        while bits >= 8:
            out.append(cur & 0xFF)
            cur >>= 8
            bits -= 8

    emit(clear)
    w = bytes([indices[0]])
    for k in indices[1:]:
        wk = w + bytes([k])
        if wk in table:
            w = wk
        else:
            emit(table[w])
            if next_code < 4096:
                table[wk] = next_code
                next_code += 1
                if next_code == (1 << code_size) and code_size < 12:
                    code_size += 1
            else:
                emit(clear)
                table = {bytes([i]): i for i in range(clear)}
                next_code = end + 1
                code_size = min_code_size + 1
            w = bytes([k])
    emit(table[w])
    emit(end)

    if bits > 0:
        out.append(cur & 0xFF)
    return bytes(out)


def subblocks(data):
    out = bytearray()
    i = 0
    while i < len(data):
        chunk = data[i : i + 255]
        out.append(len(chunk))
        out.extend(chunk)
        i += 255
    out.append(0)
    return bytes(out)


def write_gif(frames):
    # 4-color global table
    packed = (1 << 7) | (7 << 4) | 1

    out = bytearray()
    out.extend(b'GIF89a')
    out.extend((W & 0xFF, (W >> 8) & 0xFF, H & 0xFF, (H >> 8) & 0xFF))
    out.extend((packed, 0, 0))

    for r, g, b in PALETTE:
        out.extend((r, g, b))

    # loop forever
    out.extend(b'\x21\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00')

    for frame in frames:
        # GCE: no transparency
        out.extend(b'\x21\xF9\x04')
        out.extend((0b00000100,))  # disposal 1
        out.extend((DELAY_CS & 0xFF, (DELAY_CS >> 8) & 0xFF))
        out.extend((0, 0))

        # image descriptor
        out.extend(b'\x2C')
        out.extend((0, 0, 0, 0, W & 0xFF, (W >> 8) & 0xFF, H & 0xFF, (H >> 8) & 0xFF, 0))

        min_code_size = 2
        out.append(min_code_size)
        compressed = lzw_compress(min_code_size, frame)
        out.extend(subblocks(compressed))

    out.append(0x3B)
    return bytes(out)


def main():
    svg = SVG_PATH.read_text(encoding='utf-8')
    paths = transform_paths(parse_svg_paths(svg))
    if not paths:
        raise RuntimeError('No paths parsed from SVG')

    frames = [build_frame(paths, i) for i in range(FRAMES)]
    gif_data = write_gif(frames)
    OUT_PATH.write_bytes(gif_data)
    print(f'Wrote {OUT_PATH} ({len(gif_data)} bytes)')


if __name__ == '__main__':
    main()
