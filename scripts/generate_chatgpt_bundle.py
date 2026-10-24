import os
import sys
import json
import argparse
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont, ImageFilter

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORTRAITS_DIR = os.path.join(BASE_DIR, "portraits")
PHOTOS_DIR = os.path.join(BASE_DIR, "photos")
os.makedirs(PHOTOS_DIR, exist_ok=True)

THEME_PROMPTS = {
    "hangover": {
        "title": "THE HANGOVER: TOTAL BLACKOUT AFTERMATH (DER MORGEN DANACH)",
        "scene_en": "the catastrophic, completely trashed luxury penthouse suite the morning after an epic wild party night. Harsh, blinding morning sunlight painfully beams through Venetian blinds. Absolute blackout amnesia -- nobody remembers a single thing from last night. Pillow feathers and streamers float in the air, overturned coffee tables, poker chips and playing cards scattered across stained carpets, empty champagne and liquor bottles everywhere, an iron left burning on an ironing board, and in the background a live white rooster and an exotic tiger calmly lounging by the bathroom door like in the movie. Raw 35mm flash morning aftermath film style, ultra-detailed textures, glowing neon-orange timestamp in the bottom right corner: '07:23 AM - WHAT HAPPENED?!'.",
        "male_role_en": "suffering from an agonizing, extreme hangover, squinting painfully against the harsh morning daylight with shell-shocked dazed expressions, holding pounding heads with bags of frozen peas or ice packs. Hilariously ruined and missing clothing: dress shirts unbuttoned and torn, stained with huge red wine and neon cocktail drink spills, an inside-out t-shirt, wearing only patterned boxer shorts and a ruined blazer with mismatched socks and one shoe missing, a silk necktie tied around the forehead like a headband, wild disheveled bed hair with toothpicks or confetti stuck in it, smudged lipstick marks on the cheek or neck, crooked aviator sunglasses.",
        "female_role_en": "enduring a brutal catastrophic hangover with an exhausted, dazed expression, holding their pounding head in pure misery while squinting at the light. Ruined party clothes: oversized stained dress shirt worn as a tunic or torn evening wear, smudged mascara and runny eyeliner, smeared lipstick, wild messy tangled hair with confetti, one high heel on and one barefoot, a luxury hotel bathrobe hanging off one shoulder, holding an ice pack."
    },
    "altersheim": {
        "title": "SENIORENRESIDENZ SONNENSCHEIN: ALTERSHEIM-ESKALATION",
        "scene_en": "a cheerful, hilarious common room in a German retirement home ('Altersheim') completely spiraling out of control with chaotic drinking party energy. Bingo cards and pills scattered across linoleum floors, potted ferns decorated with empty beer cans. On the wall a big clock and a cross-stitch embroidery reading 'Ruhestand 2026'. Cinematic comedy movie still with warm nostalgic indoor lighting and authentic textures.",
        "male_role_en": "humorously aged into chaotic 85-year-old grandpa rascals with gray receding hair, thick reading glasses on cords, checkered knitted cardigans over collared shirts, corduroy trousers and plaid slippers, wildly cheering with beer cans mounted into their walking walkers (Rollator), someone holding an IV drip stand hooked up to a beer bottle, toothy mischievous grins.",
        "female_role_en": "hilariously aged into feisty 85-year-old grandma party queens with permed silver-gray hair, colorful floral housecoats (Kittelschuerze) or beaded twinsets, oversized retro spectacle glasses, pearl necklaces, gleefully clinking herbal liqueur schnapps glasses while sitting on electric mobility scooters, laughing heartily."
    },
    "disco80s": {
        "title": "80er JAHRE DISCO: STUDIO 54 NEON FEVER",
        "scene_en": "a vibrant, dazzling 1980s retro disco roller rink nightclub with glowing multi-colored dance floor tiles, a massive rotating mirrored disco ball showering kaleidoscopic sparkles, vintage neon arches, and purple-cyan fog. Authentic 1980s analog film photography aesthetic, vintage film grain, high saturation.",
        "male_role_en": "rocking extreme 1980s disco fashion: glorious mullet hairstyles (Vokuhila), thick chevron moustaches, neon pink and turquoise sweatbands on foreheads, unbuttoned metallic disco shirts with deep V-necks showing gold medallion necklaces, tight bell-bottom flared pants or shiny parachute pants, holding flashy neon cocktail glasses with sparklers, striking energetic dance poses.",
        "female_role_en": "dazzling in iconic 1980s party glamour: voluminous teased big perm hair with scrunchies, bright cyan eyeshadow and hot pink lip gloss, off-the-shoulder leopard glitter tops, high-waisted spandex disco leggings, leg warmers (Stulpen), neon hoop earrings, dancing with joyful confident attitude."
    },
    "sm_party": {
        "title": "DIE VERIRRTE LACK & LEDER PARTY (FETISCH-CLUB FEHLALARM)",
        "scene_en": "a mysterious, dramatic underground luxury fetish club lounge with tufted red velvet wallpaper, iron chains hanging from exposed brick walls, soft ambient candlelight, and plush leather chesterfield sofas. Pure deadpan situational comedy: the group looks utterly bewildered and out of place, asking themselves 'Who booked this location?!'. Cinematic dark comedy film still, moody red and charcoal lighting.",
        "male_role_en": "awkwardly dressed in over-the-top glossy black vinyl and studded leather biker harnesses over regular t-shirts, leather caps or studded dog collars worn with utter confusion, someone accidentally holding a small riding crop like a fly swatter, looking hilariously intimidated and embarrassed with nervous defensive grins, tightly clutching their regular bottled beers.",
        "female_role_en": "dressed in dramatic black faux-leather corsets, fishnet arm warmers, silver chains and high-gloss platform boots, sporting expressions of deadpan amusement and disbelief, holding leather whips like fashion accessories, completely amused by how ridiculous the situation has gotten."
    },
    "haushalt": {
        "title": "MAENNER VS. FRAUEN GROSSPUTZ: DER KLISCHEE-ROLLENTAUSCH",
        "scene_en": "a messy, chaotic suburban living room on Sunday morning during an extreme, exaggerated role-reversal cleaning frenzy. Dust bunnies flying, suds and soap bubbles everywhere on hardwood floors, an overturned laundry basket with clothes scattered. Bright comedic sitcom lighting, crisp 4K details.",
        "male_role_en": "stressed, sweating, utterly overwhelmed househusbands in bright pink rubber cleaning gloves, vintage floral pinnies (Kittelschuerze) over dress shirts, foam rollers in messy hair, desperately wrestling with tangled vacuum cleaner hoses or frantically ironing beer coasters, looking completely panicked and exhausted.",
        "female_role_en": "lounging in total relaxed boss mode on the leather sofa, feet kicked up on the coffee table in comfy grey sweatpants and slippers, holding cold beers with satisfied grins, pointing TV remotes and commanding the cleaning operation with hilarious smug confidence."
    },
    "sextoy": {
        "title": "DIE ESKALIERTE SEXTOY-PARTY IM WOHNZIMMER",
        "scene_en": "a traditional, extremely conservative German living room with oak wall units (Schrankwand), crocheted doilies (Haekeldeckchen), a floral coffee table with filter coffee pots and a classic hedge-hog cheese toothpick platter (Kaeseigel). In shocking comedic contrast, the entire table is humorously covered with an absurd, colorful array of novelty pink and purple silicone adult novelty gag toys, fuzzy pink handcuffs, and feathers. Comedic mockumentary film still, bright warm lighting.",
        "male_role_en": "sitting on sofa edges looking mortified, bewildered, and deeply uncomfortable, red-faced with awkward forced smiles, holding bottles of hard liquor to cope with the shock, staring wide-eyed at the absurd gadgets on the table, trying desperately to look anywhere else.",
        "female_role_en": "roaring with uncontrollable laughter and tearful giggles, playfully picking up fuzzy feather ticklers or colorful gag gadgets like microphone props, clinking glasses of sparkling prosecco, having the absolute time of their lives at the men's sheer embarrassment."
    },
    "camper": {
        "title": "DIE DAUERCAMPER: VORZELT-TERROR AM BAGGERSEE",
        "scene_en": "a classic German permanent camping site ('Dauercampingplatz') inside a cluttered awning tent (Vorzelt) next to a vintage caravan. Astro-turf green plastic carpet, clotheslines with drying towels, a smoking charcoal barbecue grilling charred sausages, plastic garden gnomes standing crookedly in gravel. Sunny summer daylight, authentic retro camp photo style, saturated nostalgic colors.",
        "male_role_en": "proud German camping kings in classic white ribbed tank tops (Feinripp-Unterhemd), faded Bermuda shorts with fanny packs (Bauchtasche), white tennis socks in blue plastic pool slides (Adiletten), holding sweating canned beers, proudly posing by the smoking grill with barbecue tongs like backyard warlords, relaxed weathered grins.",
        "female_role_en": "camping queens in colorful patterned house dresses or sun visors, oversized sunglasses, floral aprons, holding cold radler beers or spray bottles with fly swatters, lounging in striped plastic folding chairs with unapologetic boss attitude."
    },
    "soa": {
        "title": "SONS OF ANARCHY: HÜTTENCUP MOTORCYCLE CLUB (SAMCRO VIBES)",
        "scene_en": "a gritty, cinematic outlaw motorcycle club clubhouse garage and yard reminiscent of Charming, California in 'Sons of Anarchy'. Weathered red brick walls, corrugated tin roofs, a wooden club conference table with a hand-carved grim reaper emblem visible through open garage bay doors, dusty sunbeams cutting through golden haze and faint motorcycle exhaust smoke, neon beer signs, metal rolling tool cabinets, motor oil stains on concrete, and a formidable lineup of customized matte black and gleaming chrome American V-Twin cruiser motorcycles (Harley-Davidson Dynas and Road Kings with high T-bars and club fairings) parked outside on asphalt and gravel. Golden hour dusty late-afternoon sunlight, authentic 35mm Hollywood film cinematography, rich moody shadows, anamorphic lens flare, gritty ultra-detailed 8K textures.",
        "male_role_en": "hardened, loyal biker club brothers exuding raw swagger and outlaw charisma: wearing authentic distressed black leather motorcycle cuts/vests (Kutten) with club patches over dark flannel shirts, faded denim, or distressed black tees, heavy silver skull rings on fingers, worn leather riding boots, chain wallets hooked to belt loops, rugged facial hair or beards, authentic wind-blown biker hairstyles, leaning with confident cool posture against roaring choppers or sitting on leather bike saddles, holding cold longneck brown beer bottles or mechanic wrenches, intense brotherly camaraderie with stoic, menacing, or confident smirks.",
        "female_role_en": "fierce, stunning biker club queens ('Old Ladies' / Queenpins like Gemma Teller) radiating undeniable authority, loyalty, and badass boss energy: wearing fitted black leather motorcycle jackets or distressed denim vests over sleek dark tops, silver skull or dagger necklaces, aviator sunglasses resting in hair or on collar, fitted dark jeans with heavy silver buckle belts, stylish worn leather biker boots, holding cold beers or motorcycle helmets against their hips with confident, magnetic, fearless expressions."
    },
    "netto": {
        "title": "DISCOUNTER-FRÜHSCHOPPEN: 07:00 UHR VOR DEM NETTO (DER ADLER IST GELANDET)",
        "scene_en": "the gritty, authentic pavement and bicycle racks directly outside a classic German yellow-and-red discount supermarket entrance ('Netto') sharp at 07:05 AM on monthly payout day. Grey interlocking concrete paving stones, shiny metal shopping cart bays with plastic coin slots, discarded weekly grocery flyers and plastic carrier bags ('Knistertüten') resting on the curb. Pale, crisp early morning sunlight casting long shadows across the empty parking lot. Authentic documentary-comedy movie still aesthetic reminiscent of cult German TV mockumentaries (like Spiegel-TV Discounter and Dittsche), rich natural textures, in the bottom right corner a glowing neon-orange timestamp reading '07:05 AM • DER ADLER IST GELANDET'.",
        "male_role_en": "hilariously unapologetic German early-bird cult rascals celebrating payout morning in pure triumphant bliss: wearing oversized faded retro tracksuits (Jogginganzug) with neon side-stripes or worn fleece jackets, faded stonewash jeans, white tennis socks pulled high into classic blue and white plastic pool slides (Adiletten) or velcro sneakers, hand-rolled cigarettes behind ears, triumphantly clinking large 1.5-liter clear plastic PET bottles of golden discount lager beer with yellow screw-on caps and sweating 0.5-liter beer cans. One proudly waving an official stamped government benefits letter ('Bescheid vom Amt') like a winning lottery ticket with an ecstatic, toothy grin of pure carefree triumph.",
        "female_role_en": "feisty discount queens radiating hilarious triumphant attitude and zero care for the world: rocking wild bleached-blonde or colorful teased hair with hair claws, bold leopard-print or brightly colored velour tracksuits, large gold hoop earrings, a cigarette in hand, proudly holding 1.5-liter plastic PET bottles of discount beer or sweet canned sparkling wine, laughing heartily with joyful thumbs-up gestures celebrating that the monthly payment has arrived."
    },
    "new_kids": {
        "title": "NEW KIDS NITRO: MAASKANTJE HARDCORE CHAOS (JUNGE!)",
        "scene_en": "a sun-drenched, iconic Dutch suburban street in Maaskantje, Netherlands directly outside a traditional roadside snack bar ('Frituur / Cafeteria'). Parked diagonally on the curb is the legendary bright green 1980s Opel Manta sports car with huge spoilers, wide racing tires, and dice hanging from the rearview mirror. Red brick row houses, paved brick sidewalks, fry baskets, mayo stains, and crumpled discount beer cans on the ground. Authentic 1990s gabber hardcore comedy movie still aesthetic inspired by 'New Kids Turbo & New Kids Nitro', saturated colors, high-energy Dutch summer sunlight, in the bottom right corner a glowing neon-green timestamp reading 'MAASKANTJE • NIEMAND FICKT MIT UNS, JUNGE!'.",
        "male_role_en": "legendary Dutch gabber rascals rocking iconic 1990s hardcore trash fashion: glorious mullet hairstyles (Vokuhila with fluffy bangs and shaved sides), thin pencil moustaches, shiny retro nylon Australian and Cavello tracksuits with vibrant geometric patterns in teal, purple, and neon pink, white ribbed tank tops, white Nike Air Max Classic BW sneakers, gold curb link chains around necks. Posing with hilarious, hyper-aggressive, swaggering attitude: leaning on the green Opel Manta, holding sweating tall red-and-white discount beer cans ('Schultenbräu') and deep-fried Dutch snacks ('Frikandel Speciaal' oozing curry ketchup, mayonnaise, and chopped raw onions), smoking cigarettes, shouting with wide crazed victorious grins.",
        "female_role_en": "badass Dutch 90s gabber queens (Gabberinas) matching the chaotic Maaskantje energy: high tight scrunchie ponytail with shaved undercut or bleached blonde bangs, bright neon-blue eyeshadow and dark lip liner, vibrant shiny nylon tracksuit tops paired with denim hot pants or retro track pants, chunky white sneakers, large gold hoop earrings. Leaning against the car hood, holding a Schultenbräu beer can and a smoking cigarette with fierce, sarcastic, fearless party attitude."
    },
    "mafia": {
        "title": "THE GODFATHERS: COSA NOSTRA MAFIA SYNDIKAT (DON RIC & FAMIGLIA)",
        "scene_en": "a moody, opulent, dimly lit private mobster backroom lounge and cigar salon reminiscent of 'The Godfather' and 'Goodfellas'. Dark polished mahogany wood paneling, luxurious deep oxblood tufted chesterfield leather booths, an antique green felt poker table with stacks of clay chips and playing cards, glowing cut crystal whiskey decanters, and heavy aromatic blue cigar smoke swirling under a low-hanging brass billiard lamp. In the background, ornate gilded mirrors, bottles of vintage Italian Chianti wine, and rain streaking down heavy leaded glass windows overlooking a dark, wet city street. Cinematic chiaroscuro lighting, dramatic deep shadows with warm amber glows, 35mm Hollywood crime epic cinematography, in the bottom right corner an elegant golden serif timestamp reading 'THE FAMILY • OMERTA'.",
        "male_role_en": "powerful Italian-American mobsters and caporegimes radiating cold, intimidating boss authority and old-school class: dressed in impeccably tailored three-piece pinstripe double-breasted suits in charcoal, midnight navy, and black with wide peak lapels, silk pocket squares, crisp dress shirts with cufflinks, heavy gold signet rings on pinky fingers, luxury gold dress watches, slicked-back pompadour or neat side-parted hairstyles. Leaning back in heavy leather armchairs with supreme calm confidence, holding smoldering Churchill cigars or swirling amber scotch on the rocks in heavy cut-crystal tumblers, cold penetrating stares or subtle knowing smirks.",
        "female_role_en": "stunning, dangerous mob royalty ('Donnas' / Femme Fatales) radiating absolute power, luxury, and untouchable sophistication: wearing floor-length black velvet or emerald green silk evening gowns, luxurious faux-fur stoles draped over shoulders, vintage diamond or pearl jewelry, classic Hollywood waves in hair, bold crimson-red matte lipstick. Sitting beside the Don with legs crossed, holding a dirty martini glass with an olive or an elegant slim cigarette holder, possessing fierce, razor-sharp, calculating expressions of pure authority."
    }
}

def get_font(size=20, bold=False):
    candidates = [
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\segoeuib.ttf" if bold else "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\tahoma.ttf"
    ]
    for c in candidates:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                continue
    return ImageFont.load_default()

def create_reference_sheet(players_info, output_path):
    """
    Erstellt ein sauberes Referenz-Grid aller ausgewählten Gesichter.
    players_info: Liste von Dicts: [{'name': 'Ric', 'gender': 'M', 'file': 'Ric.png'}, ...]
    """
    n = len(players_info)
    if n == 0:
        return None
        
    cols = 4 if n >= 7 else (3 if n >= 4 else n)
    rows = (n + cols - 1) // cols
    
    tile_w = 320
    tile_h = 360
    header_h = 100
    
    sheet_w = cols * tile_w
    sheet_h = header_h + rows * tile_h
    
    sheet = Image.new("RGB", (sheet_w, sheet_h), (12, 16, 24))
    draw = ImageDraw.Draw(sheet)
    
    # Header
    draw.rectangle([0, 0, sheet_w, header_h], fill=(18, 24, 38))
    draw.line([(0, header_h - 1), (sheet_w, header_h - 1)], fill=(212, 175, 55), width=2)
    
    title_font = get_font(30, bold=True)
    sub_font = get_font(16, bold=False)
    
    draw.text((25, 18), "AI FACE REFERENCE SHEET • HÜTTENCUP 2026", fill=(255, 215, 0), font=title_font)
    draw.text((25, 58), "Keep exact facial identity & gender for each numbered character in the prompt", fill=(180, 195, 215), font=sub_font)
    
    name_font = get_font(18, bold=True)
    gender_font = get_font(14, bold=True)
    
    for i, p in enumerate(players_info):
        r = i // cols
        c = i % cols
        
        tx = c * tile_w
        ty = header_h + r * tile_h
        
        # Tile Rahmen
        draw.rectangle([tx + 8, ty + 8, tx + tile_w - 8, ty + tile_h - 8], fill=(22, 30, 46), outline=(45, 60, 85), width=1)
        
        # Gesicht laden
        p_path = p.get("filePath") or p.get("file")
        if not p_path or not os.path.isabs(p_path):
            candidates = [
                os.path.join(PORTRAITS_DIR, "checkin", p.get("file", "")),
                os.path.join(PORTRAITS_DIR, p.get("file", f"{p['name']}.png")),
                os.path.join(BASE_DIR, p.get("file", ""))
            ]
            p_path = None
            for cand in candidates:
                if os.path.exists(cand):
                    p_path = cand
                    break

        if p_path and os.path.exists(p_path):
            try:
                face_img = Image.open(p_path).convert("RGBA")
                face_img.thumbnail((tile_w - 40, tile_h - 120), Image.Resampling.LANCZOS)
                
                # Zentriert auf Kachel
                fw, fh = face_img.size
                fx = tx + (tile_w - fw) // 2
                fy = ty + 20 + ((tile_h - 120) - fh) // 2
                
                # Weißer Card Background für optimalen Kontrast
                draw.rectangle([fx - 4, fy - 4, fx + fw + 4, fy + fh + 4], fill=(15, 20, 32))
                sheet.paste(face_img, (fx, fy), face_img)
            except Exception as e:
                print(f"Fehler bei Bild {p['name']}: {e}", file=sys.stderr)
                
        # Badge-Box unten mit Nummer & Geschlecht
        is_female = p.get("gender", "M").upper() == "F"
        gender_color = (255, 120, 180) if is_female else (80, 180, 255)
        gender_text = "♀ FEMALE" if is_female else "♂ MALE"
        
        box_y = ty + tile_h - 75
        draw.rectangle([tx + 12, box_y, tx + tile_w - 12, ty + tile_h - 14], fill=(14, 18, 28), outline=(212, 175, 55, 120), width=1)
        
        # [1] RIC
        char_label = f"#{i+1} {p['name'].upper()}"
        draw.text((tx + 20, box_y + 8), char_label, fill=(255, 255, 255), font=name_font)
        draw.text((tx + 20, box_y + 34), gender_text, fill=gender_color, font=gender_font)
        
    sheet.save(output_path, "JPEG", quality=95)
    return output_path

def generate_prompts(theme_key, players_info, custom_setting=None):
    theme = THEME_PROMPTS.get(theme_key, THEME_PROMPTS["hangover"])
    n = len(players_info)
    if n == 0:
        return "", ""
        
    males = [p for p in players_info if p.get('gender', 'M').upper() == 'M']
    females = [p for p in players_info if p.get('gender', 'M').upper() == 'F']
    
    scene_text_en = custom_setting.strip() if custom_setting and custom_setting.strip() else theme['scene_en']
    title_text = "CUSTOM PARTY SETTING" if custom_setting and custom_setting.strip() else theme['title']

    char_breakdown = []
    for i, p in enumerate(players_info):
        is_fem = p.get('gender', 'M').upper() == 'F'
        g_label = "FEMALE" if is_fem else "MALE"
        char_breakdown.append(f"  - Character #{i+1} [{p['name'].upper()}]: {g_label} -- MUST retain the exact facial structure, facial features, age, skin tone, hair and likeness of Person #{i+1} in the reference sheet.")
    
    char_list_str = "\n".join(char_breakdown)

    gender_rule = ""
    if len(females) == 0:
        gender_rule = f"- CRITICAL GENDER RESTRICTION: ALL {n} CHARACTERS ARE MALE. DO NOT GENERATE ANY WOMEN OR FEMALE CHARACTERS IN THIS IMAGE UNDER ANY CIRCUMSTANCES.\n"
    elif len(males) == 0:
        gender_rule = f"- CRITICAL GENDER RESTRICTION: ALL {n} CHARACTERS ARE FEMALE. DO NOT GENERATE ANY MEN OR MALE CHARACTERS IN THIS IMAGE UNDER ANY CIRCUMSTANCES.\n"

    role_descriptions = []
    if males:
        male_names = ", ".join([f"#{players_info.index(p)+1} {p['name']}" for p in males])
        role_descriptions.append(f"MALE CHARACTERS ({male_names}): {theme['male_role_en']}")
    if females:
        female_names = ", ".join([f"#{players_info.index(p)+1} {p['name']}" for p in females])
        role_descriptions.append(f"FEMALE CHARACTERS ({female_names}): {theme['female_role_en']}")
    
    roles_text = "\n\n".join(role_descriptions)

    prompt_en = (
        f"A cinematic, ultra-photorealistic 16:9 movie group photograph inspired by {title_text}.\n\n"
        f"SCENE & SETTING:\n{scene_text_en}\n\n"
        f"STRICT HEADCOUNT AND ZERO-EXTRA-PEOPLE RULE (CRITICAL):\n"
        f"- There are EXACTLY {n} INDIVIDUALS in this entire photograph. NO MORE, NO LESS.\n"
        f"- DO NOT add any extra people, DO NOT add random women, DO NOT add random men, DO NOT add crowd or background people.\n"
        f"{gender_rule}"
        f"- Every single person in the image MUST correspond 1:1 to one of the {n} characters defined below:\n"
        f"{char_list_str}\n\n"
        f"CHARACTER APPEARANCE & OUTFITS:\n"
        f"{roles_text}\n\n"
        f"PHOTOGRAPHY & LIGHTING:\n"
        f"Authentic movie still photograph, flawless realistic skin textures with natural pores, cinematic ambient lighting matching the scene, realistic depth of field, 8K ultra-sharp details."
    )
    
    prompt_de = (
        f"Filmreifes 16:9 Gruppenfoto im Stil von '{title_text}'.\n\n"
        f"GENAUE PERSONENANZAHL: EXAKT {n} PERSONEN (Keine zusätzlichen Personen generieren!)\n"
        f"Szene: {scene_text_en}\n\n"
        f"Personen aus dem Referenzbild:\n{char_list_str}"
    )
    
    return prompt_en, prompt_de

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--theme", default="hangover")
    parser.add_argument("--custom_setting", default=None, help="Eigenes Wunsch-Setting für das Bild")
    parser.add_argument("--payload", default=None, help="JSON-String der Spielerinfo")
    parser.add_argument("--output", default=None)
    args = parser.parse_args()
    
    players = []
    if args.payload:
        try:
            players = json.loads(args.payload)
        except Exception:
            pass
            
    if not players:
        # Fallback auf alle existierenden Porträts mit automatischer Geschlechtserkennung
        female_names = {"mandy", "nadine", "kati", "elena", "laura", "sarah", "lisa"}
        for f in os.listdir(PORTRAITS_DIR):
            if f.lower().endswith(('.png', '.jpg', '.webp')) and not '_head' in f and not 'clean' in f:
                name = os.path.splitext(f)[0]
                gender = "F" if any(fn in name.lower() for fn in female_names) else "M"
                players.append({"name": name, "gender": gender, "file": f})
                
    out_file = args.output or os.path.join(PHOTOS_DIR, "chatgpt_reference_sheet.jpg")
    create_reference_sheet(players, out_file)
    p_en, p_de = generate_prompts(args.theme, players, args.custom_setting)
    
    res = {
        "ok": True,
        "imageUrl": "photos/chatgpt_reference_sheet.jpg",
        "fullPath": out_file,
        "theme": args.theme,
        "promptEn": p_en,
        "promptDe": p_de,
        "playerCount": len(players)
    }
    print(json.dumps(res, ensure_ascii=False))
