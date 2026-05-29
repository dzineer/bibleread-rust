# The Holy Bible — Recovery Version

Extracted from [bibleread.online](https://bibleread.online) — the complete text of the Recovery Version Bible with all footnotes, cross-references, and commentary.

## Contents

| File/Directory | Description |
|---|---|
| `index.json` | All 66 books with metadata (title, abbreviation, testament, chapter count) |
| `bible.json` | **22 MB** — All 1,189 chapters in a single JSON file |
| `bible.txt` | **9.0 MB** — Complete Bible as plain text with footnotes inline |
| `old-testament/` | 39 books, 929 chapters (Genesis → Malachi) |
| `new-testament/` | 27 books, 260 chapters (Matthew → Revelation) |

## File Format

### Per-chapter JSON (`01.json`)
```json
{
  "book_id": 107,
  "book_title": "The Gospel According to Matthew",
  "book_abbreviation": "Matt.",
  "testament": "New",
  "chapter_number": 1,
  "verses": [
    {
      "number": 1,
      "text": "The book of the generation of Jesus Christ, the son of David, the son of Abraham:",
      "markers": [
        {"superscript": "a", "word": "generation", "marker_type": "crossref"},
        {"superscript": "1", "word": "Jesus", "marker_type": "footnote"}
      ],
      "footnotes": [
        {
          "anchor": "1_1_a",
          "verse_ref": "1:1",
          "superscript": "a",
          "word": "generation",
          "text": "Luke 3:23-38; Gen. 5:1"
        }
      ]
    }
  ]
}
```

### Per-chapter Plain Text (`01.txt`)
```
The Gospel According to Matthew — Chapter 1

1  The book of the generation of Jesus Christ, the son of David, the son of Abraham:
     [a] Luke 3:23-38; Gen. 5:1
     [1] The first name and the last name (Rev. 22:21) in the New Testament is Jesus...
```

## Book Listing

### Old Testament (39 books)

| # | Book | Abbr | Chapters |
|---|------|------|----------|
| 1 | Genesis | Gen. | 50 |
| 2 | Exodus | Exo. | 40 |
| 3 | Leviticus | Lev. | 27 |
| 4 | Numbers | Num. | 36 |
| 5 | Deuteronomy | Deut. | 34 |
| 6 | Joshua | Josh. | 24 |
| 7 | Judges | Judg. | 21 |
| 8 | Ruth | Ruth | 4 |
| 9 | First Samuel | 1 Sam. | 31 |
| 10 | Second Samuel | 2 Sam. | 24 |
| 11 | First Kings | 1 Kings | 22 |
| 12 | Second Kings | 2 Kings | 25 |
| 13 | First Chronicles | 1 Chron. | 29 |
| 14 | Second Chronicles | 2 Chron. | 36 |
| 15 | Ezra | Ezra | 10 |
| 16 | Nehemiah | Neh. | 13 |
| 17 | Esther | Esth. | 10 |
| 18 | Job | Job | 42 |
| 19 | Psalms | Psa. | 150 |
| 20 | Proverbs | Prov. | 31 |
| 21 | Ecclesiastes | Eccl. | 12 |
| 22 | Song of Songs | S.S. | 8 |
| 23 | Isaiah | Isa. | 66 |
| 24 | Jeremiah | Jer. | 52 |
| 25 | Lamentations | Lam. | 5 |
| 26 | Ezekiel | Ezek. | 48 |
| 27 | Daniel | Dan. | 12 |
| 28 | Hosea | Hosea | 14 |
| 29 | Joel | Joel | 3 |
| 30 | Amos | Amos | 9 |
| 31 | Obadiah | Obad. | 1 |
| 32 | Jonah | Jonah | 4 |
| 33 | Micah | Micah | 7 |
| 34 | Nahum | Nahum | 3 |
| 35 | Habakkuk | Hab. | 3 |
| 36 | Zephaniah | Zeph. | 3 |
| 37 | Haggai | Hag. | 2 |
| 38 | Zechariah | Zech. | 14 |
| 39 | Malachi | Mal. | 4 |

### New Testament (27 books)

| # | Book | Abbr | Chapters |
|---|------|------|----------|
| 1 | Matthew | Matt. | 28 |
| 2 | Mark | Mark | 16 |
| 3 | Luke | Luke | 24 |
| 4 | John | John | 21 |
| 5 | Acts | Acts | 28 |
| 6 | Romans | Rom. | 16 |
| 7 | 1 Corinthians | 1 Cor. | 16 |
| 8 | 2 Corinthians | 2 Cor. | 13 |
| 9 | Galatians | Gal. | 6 |
| 10 | Ephesians | Eph. | 6 |
| 11 | Philippians | Phil. | 4 |
| 12 | Colossians | Col. | 4 |
| 13 | 1 Thessalonians | 1 Thes. | 5 |
| 14 | 2 Thessalonians | 2 Thes. | 3 |
| 15 | 1 Timothy | 1 Tim. | 6 |
| 16 | 2 Timothy | 2 Tim. | 4 |
| 17 | Titus | Titus | 3 |
| 18 | Philemon | Philem. | 1 |
| 19 | Hebrews | Heb. | 13 |
| 20 | James | James | 5 |
| 21 | 1 Peter | 1 Pet. | 5 |
| 22 | 2 Peter | 2 Pet. | 3 |
| 23 | 1 John | 1 John | 5 |
| 24 | 2 John | 2 John | 1 |
| 25 | 3 John | 3 John | 1 |
| 26 | Jude | Jude | 1 |
| 27 | Revelation | Rev. | 22 |

## Extraction Tool

The `bible-extractor` Rust binary can re-extract the data at any time:

```bash
./bible-extractor --delay-ms 300 --concurrency 4
./bible-extractor --book genesis            # single book
./bible-extractor --testament "New"         # testament only
./bible-extractor --resume                  # skip existing chapters
```
