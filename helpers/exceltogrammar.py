import pandas as pd
import json
from pathlib import Path

def convert_excel_to_json(
    excel_path,
    output_path="grammar.json",
    id_prefix="g"
):
    excel_path = Path(excel_path)
    output_path = Path(output_path)

    if not excel_path.exists():
        raise FileNotFoundError(f"Excel file not found: {excel_path}")

    # Read Excel (no header)
    df = pd.read_excel(excel_path, header=None)

    items = []
    for idx, row in df.iterrows():

        # Skip empty rows
        if pd.isna(row[0]) or pd.isna(row[1]) or pd.isna(row[2]):
            continue

        # Extract fields safely
        level = str(row[0]).strip()

        try:
            number = int(row[1])
        except:
            print(f"Skipping row {idx}: invalid number → {row[1]}")
            continue

        pattern = str(row[2]).strip()
        romaji = str(row[3]).strip() if not pd.isna(row[3]) else ""
        meaning = str(row[4]).strip() if not pd.isna(row[4]) else ""

        example = str(row[5]).strip() if len(row) > 5 and not pd.isna(row[5]) else ""
        example_en = str(row[6]).strip() if len(row) > 6 and not pd.isna(row[6]) else ""

        # ID like g001, g002, ...
        item_id = f"{id_prefix}{number:03d}"

        entry = {
            "id": item_id,
            "level": level,
            "pattern": pattern,
            "romaji": romaji,
            "meaning": meaning,
            "example": example,
            "example_en": example_en,
            "topic": []
        }

        items.append(entry)

    # Save JSON
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(items)} items → {output_path}")

if __name__ == "__main__":
    convert_excel_to_json("../secrets/grammarpoints.xlsx")