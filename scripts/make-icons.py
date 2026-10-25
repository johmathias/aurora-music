"""Draws the original Aurora Music app icon with Pillow (no external artwork)."""
import math, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 1024

def ribbon(color, phase, amp, y0, width, alpha):
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    pts_top, pts_bot = [], []
    for i in range(0, S + 1, 8):
        x = i
        y = y0 + amp * math.sin(i / S * 2.6 * math.pi + phase) + 0.18 * amp * math.sin(i / S * 7 + phase)
        w = width * (0.55 + 0.45 * math.sin(i / S * math.pi))
        pts_top.append((x, y - w))
        pts_bot.append((x, y + w))
    d.polygon(pts_top + pts_bot[::-1], fill=color + (alpha,))
    return layer.filter(ImageFilter.GaussianBlur(70))

def make(size_mask=False):
    base = Image.new("RGBA", (S, S), (9, 9, 14, 255))
    # soft vertical glow at the bottom
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-200, 640, S + 200, S + 520), fill=(250, 36, 60, 90))
    base = Image.alpha_composite(base, glow.filter(ImageFilter.GaussianBlur(120)))
    for color, phase, amp, y0, width, alpha in [
        ((250, 36, 60), 0.2, 120, 360, 150, 230),
        ((255, 94, 125), 1.4, 90, 470, 120, 200),
        ((126, 87, 255), 2.6, 110, 300, 110, 170),
        ((255, 159, 90), 3.4, 70, 560, 80, 150),
    ]:
        base = Image.alpha_composite(base, ribbon(color, phase, amp, y0, width, alpha))
    # music note, centered
    note = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(note)
    cx, cy = S // 2, S // 2 + 20
    d.ellipse((cx - 210, cy + 70, cx - 20, cy + 235), fill=(255, 255, 255, 255))   # left head
    d.ellipse((cx + 130, cy + 20, cx + 320, cy + 185), fill=(255, 255, 255, 255))  # right head
    d.rectangle((cx - 75, cy - 235, cx - 20, cy + 150), fill=(255, 255, 255, 255)) # left stem
    d.rectangle((cx + 265, cy - 285, cx + 320, cy + 100), fill=(255, 255, 255, 255)) # right stem
    d.polygon([(cx - 75, cy - 235), (cx + 320, cy - 330), (cx + 320, cy - 190), (cx - 75, cy - 95)], fill=(255, 255, 255, 255))  # beam
    shadow = note.filter(ImageFilter.GaussianBlur(26))
    shadow = ImageChops.multiply(shadow, Image.new("RGBA", (S, S), (0, 0, 0, 120)))
    base = Image.alpha_composite(base, shadow)
    base = Image.alpha_composite(base, note)
    return base.convert("RGB")

icon = make()
icon.resize((180, 180), Image.LANCZOS).save("public/icons/apple-touch-icon.png")
icon.resize((192, 192), Image.LANCZOS).save("public/icons/icon-192.png")
icon.resize((512, 512), Image.LANCZOS).save("public/icons/icon-512.png")
# maskable: shrink artwork into the safe zone on a matching background
mask = Image.new("RGB", (S, S), (9, 9, 14))
small = icon.resize((int(S * 0.74), int(S * 0.74)), Image.LANCZOS)
mask.paste(small, ((S - small.width) // 2, (S - small.height) // 2))
mask.resize((512, 512), Image.LANCZOS).save("public/icons/icon-maskable-512.png")
icon.resize((64, 64), Image.LANCZOS).save("public/icons/favicon.png")
print("icons ok")
