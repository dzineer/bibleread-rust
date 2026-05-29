use crate::types::*;
use anyhow::Result;
use std::fs;
use std::path::{Path, PathBuf};

/// Output directory structure.
pub struct OutputDirs {
    pub data_dir: PathBuf,
    pub old_testament: PathBuf,
    pub new_testament: PathBuf,
}

impl OutputDirs {
    pub fn create(base: &Path) -> Result<Self> {
        let data_dir = base.to_path_buf();
        let old_testament = data_dir.join("old-testament");
        let new_testament = data_dir.join("new-testament");

        fs::create_dir_all(&old_testament)?;
        fs::create_dir_all(&new_testament)?;

        Ok(Self {
            data_dir,
            old_testament,
            new_testament,
        })
    }

    pub fn book_dir(&self, testament: &str, abbreviation: &str) -> PathBuf {
        let dir_name = sanitize_dir_name(abbreviation);
        match testament {
            "Old" => self.old_testament.join(&dir_name),
            "New" => self.new_testament.join(&dir_name),
            _ => self.data_dir.join(&dir_name),
        }
    }
}

/// Write index.json with all book metadata.
pub fn write_index(books: &[BibleBook], dirs: &OutputDirs) -> Result<()> {
    let entries: Vec<IndexEntry> = books
        .iter()
        .map(|b| IndexEntry {
            book_id: b.id,
            title: b.title.clone(),
            abbreviation: b.abbreviation.clone(),
            testament: b.testament.clone(),
            url_segment: b.url_segment.clone(),
            chapters_count: b.chapters_count,
        })
        .collect();

    let path = dirs.data_dir.join("index.json");
    let json = serde_json::to_string_pretty(&entries)?;
    fs::write(&path, json)?;
    eprintln!("  Wrote index: {}", path.display());
    Ok(())
}

/// Write a single chapter as both JSON and plain text.
pub fn write_chapter(chapter: &Chapter, dirs: &OutputDirs) -> Result<()> {
    let book_dir = dirs.book_dir(&chapter.testament, &chapter.book_abbreviation);
    fs::create_dir_all(&book_dir)?;

    let ch_str = format!("{:02}", chapter.chapter_number);

    // Write JSON
    let json_path = book_dir.join(format!("{ch_str}.json"));
    let json = serde_json::to_string_pretty(chapter)?;
    fs::write(&json_path, json)?;

    // Write plain text
    let txt_path = book_dir.join(format!("{ch_str}.txt"));
    let txt = format_as_text(chapter);
    fs::write(&txt_path, txt)?;

    eprintln!(
        "  Wrote {} {} ch.{}",
        chapter.book_abbreviation,
        chapter.chapter_number,
        chapter.verses.len()
    );

    Ok(())
}

/// Format a chapter as human-readable plain text with footnotes.
fn format_as_text(chapter: &Chapter) -> String {
    let mut out = String::new();

    // Header
    out.push_str(&format!(
        "{} — Chapter {}\n\n",
        chapter.book_title, chapter.chapter_number
    ));

    for verse in &chapter.verses {
        // Verse text
        out.push_str(&format!("{}  {}\n", verse.number, verse.text));

        // Footnotes
        if !verse.footnotes.is_empty() {
            for note in &verse.footnotes {
                out.push_str(&format!(
                    "     [{}] {}\n",
                    note.superscript, note.text
                ));
            }
            out.push('\n');
        }
    }

    out
}

/// Check if a chapter file already exists (for resume support).
pub fn chapter_exists(chapter: &Chapter, dirs: &OutputDirs) -> bool {
    let book_dir = dirs.book_dir(&chapter.testament, &chapter.book_abbreviation);
    let ch_str = format!("{:02}", chapter.chapter_number);
    let json_path = book_dir.join(format!("{ch_str}.json"));
    json_path.exists()
}

/// Combine all extracted chapters into a single Bible JSON and TXT file.
pub fn write_combined(dirs: &OutputDirs) -> Result<()> {
    // Read index to get book order
    let index_path = dirs.data_dir.join("index.json");
    let index_data = fs::read_to_string(&index_path)?;
    let index: Vec<IndexEntry> = serde_json::from_str(&index_data)?;

    let mut all_chapters: Vec<Chapter> = Vec::new();
    let mut combined_txt = String::new();

    for book in &index {
        let book_dir = dirs.book_dir(&book.testament, &book.abbreviation);

        for ch_num in 1..=book.chapters_count {
            let ch_path = book_dir.join(format!("{:02}.json", ch_num));
            if ch_path.exists() {
                let data = fs::read_to_string(&ch_path)?;
                let chapter: Chapter = serde_json::from_str(&data)?;
                all_chapters.push(chapter);

                // Build combined TXT
                combined_txt.push_str(&format!(
                    "{} — Chapter {}\n\n",
                    book.title, ch_num
                ));
                if let Some(last) = all_chapters.last() {
                    for verse in &last.verses {
                        combined_txt.push_str(&format!(
                            "{}  {}\n",
                            verse.number, verse.text
                        ));
                        if !verse.footnotes.is_empty() {
                            for note in &verse.footnotes {
                                combined_txt.push_str(&format!(
                                    "     [{}] {}\n",
                                    note.superscript, note.text
                                ));
                            }
                            combined_txt.push('\n');
                        }
                    }
                }
                combined_txt.push('\n');
            }
        }
    }

    // Write combined JSON
    let json_path = dirs.data_dir.join("bible.json");
    let json = serde_json::to_string_pretty(&all_chapters)?;
    fs::write(&json_path, json)?;
    eprintln!("  Wrote combined JSON: {} ({} chapters)", json_path.display(), all_chapters.len());

    // Write combined TXT
    let txt_path = dirs.data_dir.join("bible.txt");
    fs::write(&txt_path, &combined_txt)?;
    eprintln!("  Wrote combined TXT: {} ({:.1} MB)", txt_path.display(), combined_txt.len() as f64 / 1_000_000.0);

    // Write README
    write_readme(dirs)?;

    Ok(())
}

/// Write a README.md to the data directory with format documentation and book listing.
fn write_readme(dirs: &OutputDirs) -> Result<()> {
    let index_path = dirs.data_dir.join("index.json");
    let index_data = fs::read_to_string(&index_path)?;
    let index: Vec<IndexEntry> = serde_json::from_str(&index_data)?;

    let mut readme = String::from("# The Holy Bible — Recovery Version\n\n");
    readme.push_str("Extracted from [bibleread.online](https://bibleread.online) — the complete text of the Recovery Version Bible with all footnotes, cross-references, and commentary.\n\n");

    // Stats
    let ot_books: Vec<_> = index.iter().filter(|b| b.testament == "Old").collect();
    let nt_books: Vec<_> = index.iter().filter(|b| b.testament == "New").collect();
    let ot_chapters: u32 = ot_books.iter().map(|b| b.chapters_count).sum();
    let nt_chapters: u32 = nt_books.iter().map(|b| b.chapters_count).sum();

    readme.push_str("## Contents\n\n| File/Directory | Description |\n|---|---|\n");
    readme.push_str("| `index.json` | All 66 books with metadata |\n");
    readme.push_str("| `bible.json` | All 1,189 chapters in a single JSON file |\n");
    readme.push_str("| `bible.txt` | Complete Bible as plain text with footnotes inline |\n");
    readme.push_str(&format!("| `old-testament/` | {} books, {} chapters |\n", ot_books.len(), ot_chapters));
    readme.push_str(&format!("| `new-testament/` | {} books, {} chapters |\n", nt_books.len(), nt_chapters));

    readme.push_str("\n## File Format\n\n### Per-chapter JSON\n```json\n{\n  \"book_title\": \"The Gospel According to Matthew\",\n  \"chapter_number\": 1,\n  \"verses\": [{\n    \"number\": 1,\n    \"text\": \"The book of the generation of Jesus Christ...\",\n    \"markers\": [{\"superscript\": \"1\", \"word\": \"Jesus\", \"marker_type\": \"footnote\"}],\n    \"footnotes\": [{\"superscript\": \"1\", \"text\": \"...\"}]\n  }]\n}\n```\n\n### Per-chapter Plain Text\n```\nThe Gospel According to Matthew — Chapter 1\n\n1  The book of the generation of Jesus Christ...\n     [1] The first name and the last name...\n```\n");

    // Book listing
    readme.push_str("\n## Old Testament\n\n| # | Book | Abbr | Chapters |\n|---|------|------|----------|\n");
    for (i, b) in ot_books.iter().enumerate() {
        readme.push_str(&format!("| {} | {} | {} | {} |\n", i + 1, b.title, b.abbreviation, b.chapters_count));
    }

    readme.push_str("\n## New Testament\n\n| # | Book | Abbr | Chapters |\n|---|------|------|----------|\n");
    for (i, b) in nt_books.iter().enumerate() {
        readme.push_str(&format!("| {} | {} | {} | {} |\n", i + 1, b.title, b.abbreviation, b.chapters_count));
    }

    let readme_path = dirs.data_dir.join("README.md");
    fs::write(&readme_path, readme)?;
    eprintln!("  Wrote README: {}", readme_path.display());

    Ok(())
}

/// Convert a book abbreviation into a filesystem-safe directory name.
fn sanitize_dir_name(abbr: &str) -> String {
    abbr.to_lowercase()
        .replace('.', "")
        .replace(' ', "-")
}
