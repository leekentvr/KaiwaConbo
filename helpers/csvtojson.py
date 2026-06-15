import csv
import json
import glob
import os

# Yomitan JMDict from here 
# https://github.com/yomidevs/jmdict-yomitan

# Full JLPT Vocab lists from here
# https://github.com/Bluskyo/JLPT_Vocabulary

# Quick local server test 
# python -m http.server 8000
# then open http://localhost:8000

# Grammar from here
# https://www.reddit.com/r/LearnJapanese/comments/1cwhwd8/a_handy_spreadsheet_of_over_800_jlpt_grammar/
# https://docs.google.com/spreadsheets/d/1YIVReazodB7Z1WTZ3mnLAszpFO-2WmmI/edit?usp=sharing&ouid=112139772527751582321&rtpof=true&sd=true

# ============================================================
#  LOAD Yomitan DICTIONARY (JMdict English, v3 format)
# ============================================================
def load_Yomitan(path="JMdict_english"):
    dictionary = {}

    files = glob.glob(os.path.join(path,f "term_bank_*.json"))
    if not files:
        print("❌ No Yomitan term banks found.")
        return dictionary

    print(f"📘 Loading Yomitan dictionary from {path} ...")

    for file in files:
        with open(file, encoding="utf-8") as f:
            data = json.load(f)
            for entry in data:
                if len(entry) < 6:
                    continue

                term = entry[0]
                reading = entry[1]
                pos_tag = entry[2]  # string like "n", "unc", "forms"
                glossary_struct = entry[5]  # structured content

                # Extract plain text meaning
                meaning = extract_glossary(glossary_struct)

                dictionary.setdefault(term, []).append({
                    "reading": reading,
                    "meaning": meaning,
                    "pos": pos_tag
                })

    print(f"✅ Loaded {len(dictionary)} entries.\n")
    return dictionary



# ============================================================
#  NORMALIZE MEANING
# ============================================================

def normalize_meaning(glossary):
    # glossary is a list of strings
    try:
        if isinstance(glossary, list):
            return "; ".join(str(g) for g in glossary).lower()
        return str(glossary).lower()
    except Exception:
        return ""


# ============================================================
#  PART OF SPEECH FROM TAGS
# ============================================================

def Yomitan_pos(tag):
    if not isinstance(tag, str):
        return "noun"

    tag = tag.lower()

    # verbs
    if tag.startswith("v"):
        return "verb"

    # adjectives
    if tag.startswith("adj"):
        return "adjective"

    # adverbs
    if tag == "adv":
        return "adverb"

    # particles
    if tag == "prt":
        return "particle"

    # conjunctions
    if tag == "conj":
        return "conjunction"

    # interjections
    if tag == "int":
        return "interjection"

    # nouns
    if tag == "n":
        return "noun"

    # expressions (phrases)
    if tag == "exp":
        return "expression"

    # fallback
    return "noun"



# ============================================================
#  PURE PYTHON ROMAJI CONVERTER
# ============================================================

kana_map = {
    "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
    "しゃ": "sha", "しゅ": "shu", "しょ": "sho",
    "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho",
    "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
    "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
    "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
    "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
    "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
    "じゃ": "ja",  "じゅ": "ju",  "じょ": "jo",
    "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
    "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",
}

basic_map = {
    "あ":"a","い":"i","う":"u","え":"e","お":"o",
    "か":"ka","き":"ki","く":"ku","け":"ke","こ":"ko",
    "さ":"sa","し":"shi","す":"su","せ":"se","そ":"so",
    "た":"ta","ち":"chi","つ":"tsu","て":"te","と":"to",
    "な":"na","に":"ni","ぬ":"nu","ね":"ne","の":"no",
    "は":"ha","ひ":"hi","ふ":"fu","へ":"he","ほ":"ho",
    "ま":"ma","み":"mi","む":"mu","め":"me","も":"mo",
    "や":"ya","ゆ":"yu","よ":"yo",
    "ら":"ra","り":"ri","る":"ru","れ":"re","ろ":"ro",
    "わ":"wa","を":"o","ん":"n",
    "が":"ga","ぎ":"gi","ぐ":"gu","げ":"ge","ご":"go",
    "ざ":"za","じ":"ji","ず":"zu","ぜ":"ze","ぞ":"zo",
    "だ":"da","ぢ":"ji","づ":"zu","で":"de","ど":"do",
    "ば":"ba","び":"bi","ぶ":"bu","べ":"be","ぼ":"bo",
    "ぱ":"pa","ぴ":"pi","ぷ":"pu","ぺ":"pe","ぽ":"po",
    "ゃ":"ya","ゅ":"yu","ょ":"yo",
    "っ":"*small_tsu*"
}

def to_romaji(text):
    result = ""
    i = 0
    while i < len(text):
        if i+1 < len(text) and text[i:i+2] in kana_map:
            result += kana_map[text[i:i+2]]
            i += 2
            continue

        if text[i] == "っ":
            if i+1 < len(text):
                nxt = basic_map.get(text[i+1], "")
                if nxt:
                    result += nxt[0]
            i += 1
            continue

        if text[i] in basic_map:
            result += basic_map[text[i]]
        else:
            result += text[i]

        i += 1

    return result


# ============================================================
#  CONVERSATION TOPIC CLASSIFIER
# ============================================================
def auto_topic(meaning, pos, kanji):
    m = meaning.lower()

    # 🍱 FOOD & DINING
    if any(x in m for x in [
        "eat", "drink", "food", "meal", "taste", "flavor",
        "restaurant", "cook", "boil", "bake", "fry", "snack",
        "rice", "meat", "fish", "vegetable", "fruit"
    ]):
        return ["food"]

    # ✈ TRAVEL & TRANSPORTATION
    if any(x in m for x in [
        "go", "come", "arrive", "depart", "leave", "return",
        "travel", "trip", "journey", "station", "bus", "train",
        "airport", "hotel", "map", "walk", "run", "move"
    ]):
        return ["travel"]

    # 📚 SCHOOL & STUDY
    if any(x in m for x in [
        "study", "learn", "teacher", "student", "school",
        "class", "lesson", "exam", "test", "homework",
        "university", "college", "grade"
    ]):
        return ["school"]

    # 💼 WORK & BUSINESS
    if any(x in m for x in [
        "work", "job", "office", "company", "business",
        "salary", "meeting", "boss", "employee", "task",
        "industry", "economy", "market"
    ]):
        return ["business"]

    # 💭 FEELINGS & EMOTIONS
    if any(x in m for x in [
        "feel", "emotion", "happy", "sad", "angry", "love",
        "hate", "like", "dislike", "surprise", "shock",
        "fear", "worry", "pain", "hurt"
    ]):
        return ["feelings"]

    # 🏠 HOME & DAILY LIFE
    if any(x in m for x in [
        "wake", "sleep", "clean", "wash", "live", "stay",
        "house", "home", "room", "family", "routine"
    ]):
        return ["daily_life"]

    # 👥 PEOPLE & SOCIAL LIFE
    if any(x in m for x in [
        "person", "people", "friend", "partner", "relative",
        "meet", "talk", "speak", "introduce", "relationship"
    ]):
        return ["social"]

    # 🛍 SHOPPING & MONEY
    if any(x in m for x in [
        "buy", "sell", "price", "cost", "money", "shop",
        "store", "market", "bill", "pay"
    ]):
        return ["shopping"]

    # 🏥 HEALTH & BODY
    if any(x in m for x in [
        "body", "health", "pain", "illness", "disease",
        "injury", "doctor", "medicine", "hospital"
    ]):
        return ["health"]

    # 🌦 WEATHER & SEASONS
    if any(x in m for x in [
        "weather", "rain", "snow", "wind", "sunny",
        "cloudy", "season", "spring", "summer", "autumn", "winter"
    ]):
        return ["weather"]

    # 🏞 NATURE & ENVIRONMENT
    if any(x in m for x in [
        "mountain", "river", "forest", "tree", "flower",
        "nature", "earth", "environment"
    ]):
        return ["nature"]

    # 🏙 PLACES & DIRECTIONS
    if any(x in m for x in [
        "place", "location", "area", "building", "park",
        "city", "town", "village", "right", "left", "near", "far"
    ]):
        return ["places"]

    # 🎉 HOBBIES & ENTERTAINMENT
    if any(x in m for x in [
        "play", "game", "sport", "music", "movie", "book",
        "hobby", "fun", "enjoy"
    ]):
        return ["hobbies"]

    # 📱 TECHNOLOGY & MEDIA
    if any(x in m for x in [
        "phone", "computer", "internet", "email", "media",
        "tv", "camera", "video"
    ]):
        return ["technology"]

    # 🐾 ANIMALS
    if any(x in m for x in [
        "animal", "dog", "cat", "bird", "fish", "insect"
    ]):
        return ["animals"]

    # 🎌 CULTURE & TRADITIONS
    if any(x in m for x in [
        "culture", "tradition", "festival", "holiday",
        "custom", "ceremony"
    ]):
        return ["culture"]

    # 🧹 HOUSEHOLD CHORES
    if any(x in m for x in [
        "clean", "wash", "sweep", "cook", "laundry"
    ]):
        return ["chores"]

    # 🧠 ABSTRACT IDEAS
    if any(x in m for x in [
        "concept", "idea", "notion", "abstract", "philosophy"
    ]):
        return ["abstract"]

    # 🧩 GRAMMAR / FUNCTION WORDS
    if pos in ["particle", "conjunction", "auxiliary"]:
        return ["grammar"]

    # 🌐 GENERAL (fallback)
    return ["general"]



# ============================================================
#  MAIN SCRIPT
# ============================================================

def extract_glossary(structured):
    """Extract plain English text from Yomitan structured glossary."""
    results = []

    def walk(node):
        if isinstance(node, dict):
            if "content" in node:
                walk(node["content"])
        elif isinstance(node, list):
            for item in node:
                walk(item)
        elif isinstance(node, str):
            results.append(node)

    walk(structured)
    return "; ".join(results).strip().lower()


Yomitan = load_Yomitan()
vocab = []
id_counter = 100

with open("JLPT_vocab_ALL.csv", encoding="utf-8") as f:
    reader = csv.DictReader(f)

    for idx, row in enumerate(reader, start=1):
        kanji = row["Kanji"]
        reading = row["Reading"]
        level = f"N{row['Level']}"

        entry = Yomitan.get(kanji)

        if not entry:
            entry = Yomitan.get(reading)

        if entry:
            meaning = entry[0]["meaning"]
            pos = Yomitan_pos(entry[0]["pos"])
        else:
            print(f"⚠️ No dictionary entry for {kanji} ({reading})")
            meaning = ""
            pos = "noun"

        vocab.append({
            "id": f"v{id_counter}",
            "level": level,
            "word": kanji,
            "furigana": reading,
            "romaji": to_romaji(reading),
            "meaning": meaning,
            "part_of_speech": pos,
            "topic": auto_topic(meaning, pos, kanji)
        })

        id_counter += 1

with open("output.json", "w", encoding="utf-8") as f:
    json.dump({"vocabulary": vocab}, f, ensure_ascii=False, indent=2)

print("🎉 Done! Output written to output.json")
