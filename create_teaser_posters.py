import os
import urllib.request
import urllib.parse
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# 1. Paths and Links
GUEST_URL = "https://ricfritzsche89.github.io/h-ttenkarten/guest.html"
BG_PATH = "assets/volcanic_lodge_bg.jpg"

CARDS_CONFIG = [
    {"file": "vorlagen/karte_bier_gold.png", "title": "Bierfest", "accent": (251, 191, 36)},
    {"file": "vorlagen/karte_brauerei_sudhaus.png", "title": "Sudhaus", "accent": (245, 158, 11)},
    {"file": "vorlagen/karte_werkstatt_schrauber.png", "title": "Werkstatt", "accent": (229, 196, 131)},
    {"file": "vorlagen/karte_carbon_munition.png", "title": "Carbon", "accent": (251, 191, 36)},
    {"file": "vorlagen/karte_leder_schnallen.png", "title": "Leder", "accent": (203, 213, 225)},
    {"file": "vorlagen/karte_holz_eisen.png", "title": "Huette", "accent": (217, 119, 6)},
    {"file": "vorlagen/karte_blau_tracht.png", "title": "Tracht", "accent": (110, 231, 183)},
    {"file": "vorlagen/karte_gruen_gold.png", "title": "Wald", "accent": (52, 211, 153)},
    {"file": "vorlagen/karte_glitzer_pink.png", "title": "Glitzer", "accent": (244, 114, 182)},
    {"file": "vorlagen/karte_lila_krone.png", "title": "Krone", "accent": (233, 213, 255)},
]

# Fonts
FONT_IMPACT = "C:/Windows/Fonts/impact.ttf"
FONT_ARIAL_BOLD = "C:/Windows/Fonts/arialbd.ttf"
FONT_SEGOE_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_SEGOE = "C:/Windows/Fonts/segoeui.ttf"

def get_qr_image(size=220):
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&color=0B0F17&bgcolor=FFFFFF&data={urllib.parse.quote(GUEST_URL)}"
    qr_path = "temp_qr.png"
    try:
        urllib.request.urlretrieve(qr_url, qr_path)
        img = Image.open(qr_path).convert("RGBA")
        return img
    except Exception as e:
        print("QR download failed, creating placeholder:", e)
        img = Image.new("RGBA", (size, size), (255, 255, 255, 255))
        d = ImageDraw.Draw(img)
        d.rectangle([10, 10, size-10, size-10], outline=(15, 23, 42), width=4)
        return img

def create_card_with_shadow(card_img, target_h, glow_color=(245, 158, 11)):
    aspect = card_img.width / card_img.height
    target_w = int(target_h * aspect)
    resized = card_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    pad = 40
    cw = target_w + pad * 2
    ch = target_h + pad * 2
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    
    # Shadow mask
    alpha = resized.split()[3]
    shadow_mask = Image.new("L", (cw, ch), 0)
    shadow_mask.paste(alpha, (pad, pad + 12))
    shadow_blurred = shadow_mask.filter(ImageFilter.GaussianBlur(14))
    
    # Dark shadow
    shadow_layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 200))
    canvas.paste(shadow_layer, (0, 0), shadow_blurred)
    
    # Colored ambient glow behind card
    glow_mask = Image.new("L", (cw, ch), 0)
    glow_mask.paste(alpha, (pad, pad))
    glow_blurred = glow_mask.filter(ImageFilter.GaussianBlur(20))
    glow_layer = Image.new("RGBA", (cw, ch), glow_color + (140,))
    canvas.paste(glow_layer, (0, 0), glow_blurred)
    
    # Paste actual card
    canvas.paste(resized, (pad, pad), resized)
    return canvas, target_w, target_h, pad

# ========================================================
# 1. STORY / STATUS POSTER (1080 x 1920 - 9:16 Vertical)
# ========================================================
def generate_story_poster():
    W, H = 1080, 1920
    print("Generating Story Poster (1080x1920)...")
    
    bg = Image.open(BG_PATH).convert("RGBA")
    bg_ratio = bg.width / bg.height
    target_ratio = W / H
    if bg_ratio > target_ratio:
        new_w = int(bg.height * target_ratio)
        offset = (bg.width - new_w) // 2
        bg = bg.crop((offset, 0, offset + new_w, bg.height))
    else:
        new_h = int(bg.width / target_ratio)
        offset = (bg.height - new_h) // 2
        bg = bg.crop((0, offset, bg.width, offset + new_h))
    bg = bg.resize((W, H), Image.Resampling.LANCZOS)
    
    tint = Image.new("RGBA", (W, H), (6, 9, 15, 200))
    poster = Image.alpha_composite(bg, tint)
    draw = ImageDraw.Draw(poster)
    
    # Top Badge
    font_badge = ImageFont.truetype(FONT_ARIAL_BOLD, 21)
    badge_text = "HÜTTEN-CUP 2026  |  OFFIZIELLES TURNIER"
    bw = draw.textlength(badge_text, font=font_badge)
    bx0, by0 = (W - bw) / 2 - 25, 75
    bx1, by1 = bx0 + bw + 50, by0 + 44
    draw.rounded_rectangle([bx0, by0, bx1, by1], radius=22, fill=(245, 158, 11, 45), outline=(245, 158, 11, 160), width=2)
    draw.text(((W - bw)/2, by0 + 9), badge_text, fill=(254, 240, 138), font=font_badge)
    
    # Main Headline
    font_title1 = ImageFont.truetype(FONT_IMPACT, 75)
    font_title2 = ImageFont.truetype(FONT_IMPACT, 68)
    
    t1 = "ERSTELLE DEINE EIGENE"
    t2 = "HÜTTEN-SAMMELKARTE!"
    
    w1 = draw.textlength(t1, font=font_title1)
    w2 = draw.textlength(t2, font=font_title2)
    
    draw.text(((W - w1)/2 + 3, 140 + 3), t1, fill=(0, 0, 0, 220), font=font_title1)
    draw.text(((W - w1)/2, 140), t1, fill=(255, 255, 255), font=font_title1)
    
    draw.text(((W - w2)/2 + 3, 222 + 3), t2, fill=(180, 83, 9, 220), font=font_title2)
    draw.text(((W - w2)/2, 222), t2, fill=(251, 191, 36), font=font_title2)
    
    # Subtitle
    font_sub = ImageFont.truetype(FONT_SEGOE_BOLD, 26)
    sub1 = "Wie bei FIFA / FUT bekommt jeder Gast sein eigenes Unikat"
    sub2 = "für das große Turnier und den 4K-Live-Arena-Bildschirm!"
    sw1 = draw.textlength(sub1, font=font_sub)
    sw2 = draw.textlength(sub2, font=font_sub)
    draw.text(((W - sw1)/2, 310), sub1, fill=(226, 232, 240), font=font_sub)
    draw.text(((W - sw2)/2, 348), sub2, fill=(203, 213, 225), font=font_sub)
    
    # 10 CARDS GRID (2 Rows of 5)
    font_card_tag = ImageFont.truetype(FONT_ARIAL_BOLD, 17)
    card_h = 320
    cards_per_row = 5
    
    row_y_starts = [425, 785]
    for row_idx in range(2):
        row_cards = CARDS_CONFIG[row_idx * cards_per_row : (row_idx + 1) * cards_per_row]
        row_imgs = []
        total_content_w = 0
        for c in row_cards:
            raw = Image.open(c["file"]).convert("RGBA")
            c_canvas, cw, ch, pad = create_card_with_shadow(raw, card_h, c["accent"])
            row_imgs.append((c_canvas, cw, ch, pad, c["title"], c["accent"]))
            total_content_w += cw
        
        spacing = (W - total_content_w) // (cards_per_row + 1)
        cur_x = spacing
        y = row_y_starts[row_idx]
        
        for c_canvas, cw, ch, pad, title, accent in row_imgs:
            poster.paste(c_canvas, (cur_x - pad, y - pad), c_canvas)
            lw = draw.textlength(title, font=font_card_tag)
            lx = cur_x + (cw - lw) // 2
            ly = y + ch + 8
            draw.rounded_rectangle([lx - 10, ly - 3, lx + lw + 10, ly + 22], radius=10, fill=(15, 23, 42, 220), outline=accent, width=1)
            draw.text((lx, ly), title, fill=(255, 255, 255), font=font_card_tag)
            cur_x += cw + spacing

    # 3 STEPS EXPLANATION BOX
    box_y = 1170
    draw.rounded_rectangle([45, box_y, W - 45, box_y + 195], radius=24, fill=(15, 23, 42, 220), outline=(245, 158, 11, 100), width=2)
    
    font_step_h = ImageFont.truetype(FONT_ARIAL_BOLD, 22)
    font_step_p = ImageFont.truetype(FONT_SEGOE_BOLD, 17)
    
    steps = [
        ("1. SELFIE KNIPSEN", "Automatisch freigestellt"),
        ("2. SKILLS VERGEBEN", "Durst, Treffsicherheit & Co."),
        ("3. IM TV-DASHBOARD", "Live bei Bierpong & Matches")
    ]
    
    col_w = (W - 90) // 3
    for i, (st, sp) in enumerate(steps):
        cx = 45 + i * col_w + col_w // 2
        stw = draw.textlength(st, font=font_step_h)
        spw = draw.textlength(sp, font=font_step_p)
        draw.text((cx - stw / 2, box_y + 45), st, fill=(251, 191, 36), font=font_step_h)
        draw.text((cx - spw / 2, box_y + 95), sp, fill=(226, 232, 240), font=font_step_p)

    # FOOTER & QR CODE CALLOUT
    qr_img = get_qr_image(size=230)
    qr_x = 75
    qr_y = 1410
    
    draw.rounded_rectangle([qr_x - 12, qr_y - 12, qr_x + 230 + 12, qr_y + 230 + 12], radius=20, fill=(255, 255, 255, 255), outline=(245, 158, 11, 200), width=3)
    poster.paste(qr_img, (qr_x, qr_y), qr_img)
    
    callout_x = qr_x + 230 + 35
    font_cta_huge = ImageFont.truetype(FONT_IMPACT, 52)
    font_cta_sub = ImageFont.truetype(FONT_SEGOE_BOLD, 23)
    font_url = ImageFont.truetype(FONT_ARIAL_BOLD, 21)
    
    draw.text((callout_x, qr_y + 15), "JETZT MITMACHEN!", fill=(254, 240, 138), font=font_cta_huge)
    draw.text((callout_x, qr_y + 80), "Scanne den QR-Code oder nutze den Link,", fill=(255, 255, 255), font=font_cta_sub)
    draw.text((callout_x, qr_y + 115), "um deine Karte in 2 Minuten zu erstellen:", fill=(203, 213, 225), font=font_cta_sub)
    
    url_text = "ricfritzsche89.github.io/h-ttenkarten/guest.html"
    draw.rounded_rectangle([callout_x, qr_y + 160, callout_x + 600, qr_y + 215], radius=14, fill=(15, 23, 42, 240), outline=(245, 158, 11, 200), width=2)
    draw.text((callout_x + 20, qr_y + 175), "LINK:  " + url_text, fill=(251, 191, 36), font=font_url)

    font_wm = ImageFont.truetype(FONT_SEGOE_BOLD, 18)
    wm = "GUENSTENBERGE 2026  |  10 EXKLUSIVE KARTENDESIGNS  |  LIVE-SYNC IM TV"
    wm_w = draw.textlength(wm, font=font_wm)
    draw.text(((W - wm_w)/2, H - 70), wm, fill=(148, 163, 184), font=font_wm)
    
    out_path = "teaser_huettencup_2026_story.png"
    poster.save(out_path, quality=95)
    print("Done:", out_path)
    return out_path

# ========================================================
# 2. LANDSCAPE TEASER POSTER (1920 x 1080 - 16:9 Widescreen)
# ========================================================
def generate_landscape_poster():
    W, H = 1920, 1080
    print("Generating Landscape Poster (1920x1080)...")
    
    bg = Image.open(BG_PATH).convert("RGBA")
    bg = bg.resize((W, H), Image.Resampling.LANCZOS)
    
    tint = Image.new("RGBA", (W, H), (6, 9, 15, 195))
    poster = Image.alpha_composite(bg, tint)
    draw = ImageDraw.Draw(poster)
    
    left_margin = 75
    
    # Badge
    font_badge = ImageFont.truetype(FONT_ARIAL_BOLD, 19)
    badge_text = "HÜTTEN-CUP 2026  |  OFFIZIELLES SAMMELALBUM"
    bw = draw.textlength(badge_text, font=font_badge)
    draw.rounded_rectangle([left_margin, 60, left_margin + bw + 36, 60 + 38], radius=19, fill=(245, 158, 11, 45), outline=(245, 158, 11, 160), width=2)
    draw.text((left_margin + 18, 68), badge_text, fill=(254, 240, 138), font=font_badge)
    
    # Titles
    font_title1 = ImageFont.truetype(FONT_IMPACT, 64)
    font_title2 = ImageFont.truetype(FONT_IMPACT, 58)
    
    draw.text((left_margin + 2, 120 + 2), "ERSTELLE DEINE EIGENE", fill=(0, 0, 0, 220), font=font_title1)
    draw.text((left_margin, 120), "ERSTELLE DEINE EIGENE", fill=(255, 255, 255), font=font_title1)
    
    draw.text((left_margin + 2, 195 + 2), "HÜTTEN-SAMMELKARTE!", fill=(180, 83, 9, 220), font=font_title2)
    draw.text((left_margin, 195), "HÜTTEN-SAMMELKARTE!", fill=(251, 191, 36), font=font_title2)
    
    # Subtitle
    font_desc = ImageFont.truetype(FONT_SEGOE_BOLD, 22)
    draw.text((left_margin, 275), "Jeder Gast bekommt sein persönliches FUT-Karten-Unikat!", fill=(226, 232, 240), font=font_desc)
    draw.text((left_margin, 310), "Live im 4K-TV-Dashboard bei Bierpong, Darts & Matches.", fill=(203, 213, 225), font=font_desc)

    # 3 Steps Pill Rows
    step_y = 370
    font_step_title = ImageFont.truetype(FONT_ARIAL_BOLD, 20)
    font_step_desc = ImageFont.truetype(FONT_SEGOE, 18)
    
    steps = [
        ("1. Selfie machen", "Wird automatisch per KI freigestellt"),
        ("2. Skills vergeben", "Durst, Treffsicherheit & Position wählen"),
        ("3. TV-Dashboard", "Deine Karte live auf dem 4K-Bildschirm!")
    ]
    for i, (st, sd) in enumerate(steps):
        sy = step_y + i * 58
        draw.rounded_rectangle([left_margin, sy, left_margin + 620, sy + 48], radius=14, fill=(15, 23, 42, 200), outline=(245, 158, 11, 70), width=1)
        draw.text((left_margin + 18, sy + 11), st, fill=(251, 191, 36), font=font_step_title)
        draw.text((left_margin + 215, sy + 13), sd, fill=(226, 232, 240), font=font_step_desc)

    # Bottom Left: QR Code & Callout Card
    cta_box_y = 575
    draw.rounded_rectangle([left_margin, cta_box_y, left_margin + 620, cta_box_y + 400], radius=24, fill=(15, 23, 42, 220), outline=(245, 158, 11, 160), width=2)
    
    qr_img = get_qr_image(size=210)
    qr_x = left_margin + 30
    qr_y = cta_box_y + 35
    draw.rounded_rectangle([qr_x - 10, qr_y - 10, qr_x + 210 + 10, qr_y + 210 + 10], radius=16, fill=(255, 255, 255), outline=(245, 158, 11, 220), width=2)
    poster.paste(qr_img, (qr_x, qr_y), qr_img)
    
    call_x = qr_x + 210 + 30
    font_call_h = ImageFont.truetype(FONT_IMPACT, 42)
    font_call_p = ImageFont.truetype(FONT_SEGOE_BOLD, 20)
    font_call_sub = ImageFont.truetype(FONT_SEGOE, 17)
    
    draw.text((call_x, qr_y + 10), "JETZT MITMACHEN!", fill=(254, 240, 138), font=font_call_h)
    draw.text((call_x, qr_y + 70), "QR-Code scannen", fill=(255, 255, 255), font=font_call_p)
    draw.text((call_x, qr_y + 100), "oder Link am Handy öffnen", fill=(203, 213, 225), font=font_call_sub)
    draw.text((call_x, qr_y + 135), "- Dauert nur 2 Minuten!", fill=(52, 211, 153), font=font_call_p)
    draw.text((call_x, qr_y + 165), "- Sofortiges Foto-Feedback", fill=(148, 163, 184), font=font_call_sub)
    
    # URL Bar
    url_text = "ricfritzsche89.github.io/h-ttenkarten/guest.html"
    font_url = ImageFont.truetype(FONT_ARIAL_BOLD, 17)
    draw.rounded_rectangle([left_margin + 30, cta_box_y + 305, left_margin + 590, cta_box_y + 360], radius=12, fill=(6, 9, 15), outline=(245, 158, 11, 150), width=1)
    draw.text((left_margin + 50, cta_box_y + 322), "LINK:  " + url_text, fill=(251, 191, 36), font=font_url)

    # RIGHT SIDE: 10 CARDS IN 2 ROWS OF 5
    font_card_lbl = ImageFont.truetype(FONT_ARIAL_BOLD, 17)
    card_h = 390
    cards_per_row = 5
    
    right_start_x = 760
    right_w = W - right_start_x - 50
    row_y_starts = [85, 545]
    
    for row_idx in range(2):
        row_cards = CARDS_CONFIG[row_idx * cards_per_row : (row_idx + 1) * cards_per_row]
        row_imgs = []
        total_content_w = 0
        for c in row_cards:
            raw = Image.open(c["file"]).convert("RGBA")
            c_canvas, cw, ch, pad = create_card_with_shadow(raw, card_h, c["accent"])
            row_imgs.append((c_canvas, cw, ch, pad, c["title"], c["accent"]))
            total_content_w += cw
        
        spacing = (right_w - total_content_w) // (cards_per_row + 1)
        cur_x = right_start_x + spacing
        y = row_y_starts[row_idx]
        
        for c_canvas, cw, ch, pad, title, accent in row_imgs:
            poster.paste(c_canvas, (cur_x - pad, y - pad), c_canvas)
            tw = draw.textlength(title, font=font_card_lbl)
            tx = cur_x + (cw - tw) // 2
            ty = y + ch + 8
            draw.rounded_rectangle([tx - 10, ty - 3, tx + tw + 10, ty + 22], radius=9, fill=(15, 23, 42, 230), outline=accent, width=1)
            draw.text((tx, ty), title, fill=(255, 255, 255), font=font_card_lbl)
            cur_x += cw + spacing

    # Bottom watermark
    font_wm = ImageFont.truetype(FONT_SEGOE_BOLD, 17)
    wm = "GUENSTENBERGE 2026  |  10 OFFIZIELLE SAMMELKARTEN-ROHLINGE  |  LIVE IM TV-SCOREBOARD"
    wm_w = draw.textlength(wm, font=font_wm)
    draw.text(((W - wm_w)/2, H - 32), wm, fill=(148, 163, 184), font=font_wm)

    out_path = "teaser_huettencup_2026_landscape.png"
    poster.save(out_path, quality=95)
    print("Done:", out_path)
    return out_path

if __name__ == "__main__":
    generate_story_poster()
    generate_landscape_poster()
    if os.path.exists("temp_qr.png"):
        os.remove("temp_qr.png")
