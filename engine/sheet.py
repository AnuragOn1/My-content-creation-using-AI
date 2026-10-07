"""Contact sheet of stills for quick QA: python3 sheet.py out.png a.png b.png ..."""
import sys
from PIL import Image, ImageDraw

out, files = sys.argv[1], sys.argv[2:]
cols = min(4, len(files))
rows = (len(files) + cols - 1) // cols
tw, th = 405, 720
sheet = Image.new("RGB", (cols * tw + (cols + 1) * 10, rows * (th + 30) + 10), (40, 40, 40))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
    x = 10 + (i % cols) * (tw + 10)
    y = 10 + (i // cols) * (th + 30)
    sheet.paste(im, (x, y))
    d.text((x + 4, y + th + 6), f.split("/")[-1], fill=(220, 220, 220))
sheet.save(out)
