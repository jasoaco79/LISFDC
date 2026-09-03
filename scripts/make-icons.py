#!/usr/bin/env python3
"""Write simple dark PNG icons with no third-party deps."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, size: int, rgba: list[tuple[int, int, int, int]]) -> None:
    raw = b"".join(b"\x00" + b"".join(bytes(px) for px in rgba[y * size : (y + 1) * size]) for y in range(size))
    png = b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)),
            chunk(b"IDAT", zlib.compress(raw, 9)),
            chunk(b"IEND", b""),
        ]
    )
    path.write_bytes(png)


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def icon_pixels(size: int) -> list[tuple[int, int, int, int]]:
    pixels: list[tuple[int, int, int, int]] = []
    radius = size * 0.22
    for y in range(size):
        for x in range(size):
            nx = x / (size - 1)
            ny = y / (size - 1)
            # rounded-rect mask
            px = min(x, size - 1 - x)
            py = min(y, size - 1 - y)
            if px < radius and py < radius:
                dx = radius - px
                dy = radius - py
                inside = dx * dx + dy * dy <= radius * radius
            else:
                inside = True
            if not inside:
                pixels.append((0, 0, 0, 0))
                continue
            bg = (
                lerp(18, 36, ny),
                lerp(22, 40, nx),
                lerp(28, 48, (nx + ny) / 2),
                255,
            )
            # teal bar
            if 0.22 < nx < 0.40 and 0.28 < ny < 0.78:
                pixels.append((74, 163, 160, 255))
            # cream bar
            elif 0.48 < nx < 0.78 and 0.28 < ny < 0.52:
                pixels.append((232, 237, 242, 255))
            else:
                pixels.append(bg)
    return pixels


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "icons"
    out.mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        write_png(out / f"icon{size}.png", size, icon_pixels(size))
        print(f"wrote {out / f'icon{size}.png'}")


if __name__ == "__main__":
    main()
