"""Genera los iconos PNG de la PWA a partir de la misma geometría que icons/icon.svg."""
from PIL import Image, ImageDraw
import os

BG = (11, 12, 13, 255)
YELLOW = (255, 199, 44, 255)
CHALK = (244, 245, 247, 255)
RED = (200, 16, 46, 255)

S = 512.0
BAR = (96, 238, 416, 274)
OUTER_L = (60, 176, 100, 336)
OUTER_R = (412, 176, 452, 336)
INNER_L = (112, 196, 146, 316)
INNER_R = (366, 196, 400, 316)


def scaled(box, size, safe):
    """Escala una caja del lienzo de 512 al tamaño pedido, con margen de zona segura."""
    k = size / S * (0.72 if safe else 1.0)
    cx = cy = size / 2.0
    x0, y0, x1, y1 = box
    mx, my = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    return [cx + (mx - cx) * k - (x1 - x0) / 2.0 * k,
            cy + (my - cy) * k - (y1 - y0) / 2.0 * k,
            cx + (mx - cx) * k + (x1 - x0) / 2.0 * k,
            cy + (my - cy) * k + (y1 - y0) / 2.0 * k]


def build(size, safe=False, rounded=True):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded and not safe:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.1875), fill=BG)
    else:
        d.rectangle([0, 0, size, size], fill=BG)
    r = max(1, int(size * 0.012))
    d.rounded_rectangle(scaled(BAR, size, safe), radius=r, fill=YELLOW)
    for box in (OUTER_L, OUTER_R):
        d.rounded_rectangle(scaled(box, size, safe), radius=int(size * 0.014), fill=CHALK)
    for box in (INNER_L, INNER_R):
        d.rounded_rectangle(scaled(box, size, safe), radius=int(size * 0.012), fill=RED)
    return img


here = os.path.dirname(os.path.abspath(__file__))
build(180).save(os.path.join(here, "apple-touch-icon.png"))   # iOS: pantalla de inicio
build(192).save(os.path.join(here, "icon-192.png"))
build(512).save(os.path.join(here, "icon-512.png"))
build(512, safe=True).save(os.path.join(here, "icon-maskable-512.png"))
print("iconos generados")
