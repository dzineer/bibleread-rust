use crate::types::*;
use anyhow::{Context, Result};
use regex::Regex;
use scraper::{Html, Selector};
use std::sync::OnceLock;

const BASE_URL: &str = "https://bibleread.online";

fn client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client")
    })
}

/// Fetch the book list from the main Bible page's embedded JSON.
pub async fn fetch_books() -> Result<Vec<BibleBook>> {
    let url = format!("{BASE_URL}/bible/");
    let html = client().get(&url).send().await?.text().await?;
    parse_books_from_html(&html)
}

/// Parse the `App.Collections.books.reset([...])` block from the HTML.
pub fn parse_books_from_html(html: &str) -> Result<Vec<BibleBook>> {
    let re = Regex::new(r"App\.Collections\.books\.reset\((\[[\s\S]*?\])\s*\)\s*;")
        .context("Failed to compile books regex")?;

    let cap = re
        .captures(html)
        .context("Could not find App.Collections.books.reset(...) in HTML")?;

    let json_str = cap.get(1).unwrap().as_str();
    let all_books: Vec<BibleBook> =
        serde_json::from_str(json_str).context("Failed to parse books JSON")?;

    // Keep only Bible books (not Life-Study, not Common books)
    let bible_books: Vec<BibleBook> = all_books
        .into_iter()
        .filter(|b| b.book_type == "BibleBook")
        .collect();

    Ok(bible_books)
}

/// Fetch chapter metadata from /app/getChapters/
/// The server returns a JSON-encoded string that itself contains JSON,
/// so we double-parse.
pub async fn fetch_chapters() -> Result<Vec<ChapterMeta>> {
    let url = format!("{BASE_URL}/app/getChapters/");
    let text = client()
        .get(&url)
        .send()
        .await?
        .text()
        .await?;

    // The response is a JSON string containing JSON data (double-encoded)
    // Try direct parse first, then try as a JSON string
    let resp: ChaptersResponse = match serde_json::from_str(&text) {
        Ok(r) => r,
        Err(_) => {
            // It might be a JSON-encoded string
            let inner: String = serde_json::from_str(&text)
                .context("Failed to parse chapters response as JSON string")?;
            serde_json::from_str(&inner)
                .context("Failed to parse inner chapters JSON")?
        }
    };

    Ok(resp.chapters)
}

/// Fetch a chapter page and parse verses + markers.
#[allow(dead_code)]
pub async fn fetch_chapter_page(book_segment: &str, chapter_num: u32) -> Result<Vec<Verse>> {
    let url = format!("{BASE_URL}/bible/{book_segment}/{chapter_num}/");
    let html = client().get(&url).send().await?.text().await?;
    parse_chapter_html(&html, chapter_num)
}

/// Parse the verse divs from a chapter HTML page.
pub fn parse_chapter_html(html: &str, _chapter_num: u32) -> Result<Vec<Verse>> {
    let document = Html::parse_document(html);

    let verse_sel =
        Selector::parse("div.verse_text.jVerse").map_err(|e| anyhow::anyhow!("{e}"))?;
    let anchor_sel = Selector::parse("span.anchor").map_err(|e| anyhow::anyhow!("{e}"))?;
    let sup_sel = Selector::parse("sup").map_err(|e| anyhow::anyhow!("{e}"))?;

    let mut verses = Vec::new();

    for verse_el in document.select(&verse_sel) {
        let num_str = verse_el
            .value()
            .attr("data-num")
            .unwrap_or("0");
        let number: u32 = num_str.parse().unwrap_or(0);
        if number == 0 {
            continue;
        }

        // Get the full inner HTML to preserve structure
        let inner_html = verse_el.inner_html();

        // Extract markers
        let mut markers = Vec::new();

        // Re-parse this verse's html to walk the DOM tree
        let verse_frag = Html::parse_fragment(&inner_html);

        for anchor_el in verse_frag.select(&anchor_sel) {
            // Get the superscript text
            if let Some(sup_el) = anchor_el.select(&sup_sel).next() {
                let sup_text = sup_el.text().collect::<String>().trim().to_string();

                // Get the word after the sup — text nodes in the anchor span
                let word = anchor_el
                    .text()
                    .collect::<String>()
                    .trim()
                    .to_string();
                // The word is the full text minus the superscript part
                let word = word
                    .strip_prefix(&sup_text)
                    .unwrap_or(&word)
                    .trim()
                    .to_string();

                let marker_type = if sup_text
                    .chars()
                    .next()
                    .map(|c| c.is_ascii_digit())
                    .unwrap_or(false)
                {
                    MarkerType::Footnote
                } else {
                    MarkerType::CrossRef
                };

                markers.push(Marker {
                    superscript: sup_text,
                    word,
                    marker_type,
                });
            }
        }

        // Extract clean text: remove verse_url and verse_name wrapper elements,
        // then strip remaining HTML tags
        let clean_text = {
            // First, remove <strong class="verse_url">...</strong> and
            // <strong class="verse_name">...</strong> entirely
            let url_re = Regex::new(r#"<strong class="verse_url">[\s\S]*?</strong>"#).unwrap();
            let name_re = Regex::new(r#"<strong class="verse_name">[\s\S]*?</strong>"#).unwrap();
            let cleaned = url_re.replace_all(&inner_html, "");
            let cleaned = name_re.replace_all(&cleaned, "");
            strip_html_tags(&cleaned)
        };

        // Strip superscript markers from the text since they're captured in `markers`
        let clean_text = strip_markers_from_text(&clean_text, &markers);

        verses.push(Verse {
            number,
            text: clean_text,
            markers,
            footnotes: Vec::new(),
        });
    }

    Ok(verses)
}

/// Remove superscript markers from the verse text (e.g. "a generation" → "generation").
/// Sorts markers by superscript length descending to avoid partial-match issues.
fn strip_markers_from_text(text: &str, markers: &[Marker]) -> String {
    let mut result = text.to_string();
    let mut sorted: Vec<&Marker> = markers.iter().collect();
    sorted.sort_by(|a, b| b.superscript.len().cmp(&a.superscript.len()));

    for marker in &sorted {
        // Pattern: "<superscript> <word>"
        let pattern = format!("{} {}", marker.superscript, marker.word);
        result = result.replace(&pattern, &marker.word);
    }

    result
}

/// Fetch a note page and parse footnote/cross-reference content.
#[allow(dead_code)]
pub async fn fetch_note_page(
    book_segment: &str,
    chapter_num: u32,
) -> Result<FootnoteMap> {
    let url = format!("{BASE_URL}/note/{book_segment}/{chapter_num}/");
    let html = client().get(&url).send().await?.text().await?;
    parse_note_html(&html)
}

/// Parse the footnote/cross-reference list from a note page.
pub fn parse_note_html(html: &str) -> Result<FootnoteMap> {
    let document = Html::parse_document(html);

    let note_sel = Selector::parse("li.jNote").map_err(|e| anyhow::anyhow!("{e}"))?;
    let sup_sel = Selector::parse("sup").map_err(|e| anyhow::anyhow!("{e}"))?;
    let p_sel = Selector::parse("p").map_err(|e| anyhow::anyhow!("{e}"))?;
    let a_sel = Selector::parse("a").map_err(|e| anyhow::anyhow!("{e}"))?;

    let mut map = FootnoteMap::new();

    for note_el in document.select(&note_sel) {
        let anchor = note_el
            .value()
            .attr("data-anchor")
            .unwrap_or("")
            .to_string();
        if anchor.is_empty() {
            continue;
        }

        // Get the superscript
        let superscript = note_el
            .select(&sup_sel)
            .next()
            .map(|s| s.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        // Get the verse reference from the <a> link
        let verse_ref = note_el
            .select(&a_sel)
            .next()
            .map(|a| a.text().collect::<String>().trim().to_string())
            .unwrap_or_default();

        // Get the word — text nodes directly in the <li> that are not inside <p>, <a>, <sup>, <b>
        // The word is typically in a <b> tag
        let word = {
            let b_sel = Selector::parse("b").unwrap();
            note_el
                .select(&b_sel)
                .next()
                .map(|b| b.text().collect::<String>().trim().to_string())
                .unwrap_or_default()
        };

        // Get footnote text from <p> elements
        let text = note_el
            .select(&p_sel)
            .map(|p| p.text().collect::<String>().trim().to_string())
            .collect::<Vec<_>>()
            .join("\n\n");

        map.insert(
            anchor.clone(),
            FootnoteDetail {
                anchor,
                verse_ref,
                superscript,
                word,
                text,
            },
        );
    }

    Ok(map)
}

/// Merge footnote details into verse markers.
pub fn merge_footnotes(verses: &mut [Verse], footnote_map: &FootnoteMap, chapter_num: u32) {
    for verse in verses.iter_mut() {
        let mut footnotes = Vec::new();

        for marker in &verse.markers {
            let anchor = format!("{}_{}_{}", chapter_num, verse.number, marker.superscript);
            if let Some(detail) = footnote_map.get(&anchor) {
                footnotes.push(detail.clone());
            }
        }

        verse.footnotes = footnotes;
    }
}

/// Strip HTML tags from a string, returning plain text.
fn strip_html_tags(input: &str) -> String {
    let re = Regex::new(r"<[^>]*>").unwrap();
    let result = re.replace_all(input, " ").to_string();
    // Collapse whitespace
    let ws_re = Regex::new(r"\s+").unwrap();
    let text = ws_re.replace_all(&result, " ").trim().to_string();
    // Fix punctuation spacing: "word ," → "word,"
    clean_punctuation_spacing(&text)
}

/// Fix spaces before punctuation introduced by HTML tag stripping.
fn clean_punctuation_spacing(text: &str) -> String {
    let result = text.to_string();
    // Remove space before punctuation
    let pu_re = Regex::new(r"\s+([,.;:!?])").unwrap();
    let result = pu_re.replace_all(&result, "$1").to_string();
    // Remove space after opening paren
    let op_re = Regex::new(r"\(\s+").unwrap();
    let result = op_re.replace_all(&result, "(").to_string();
    // Remove space before closing paren
    let cp_re = Regex::new(r"\s+\)").unwrap();
    let result = cp_re.replace_all(&result, ")").to_string();
    // Collapse any double spaces created
    let ws_re = Regex::new(r"\s+").unwrap();
    ws_re.replace_all(&result, " ").trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_books_from_html() {
        let html = r#"
        <script>
        App.Collections.books.reset([
            {"id":98,"title":"Genesis","bookType":"BibleBook","urlSegment":"genesis","testament":"Old","number":1,"group":1,"chaptersCount":50,"abbreviation":"Gen.","fullName":"Genesis","shortName":"Gen"},
            {"id":125,"title":"Life-Study of Genesis","bookType":"Lifestudy","urlSegment":"life-study-of-genesis","testament":"Old","number":1,"group":1,"chaptersCount":120,"abbreviation":"Gen.","fullName":"Genesis","shortName":"Gen"}
        ]);
        </script>
        "#;
        let books = parse_books_from_html(html).unwrap();
        assert_eq!(books.len(), 1);
        assert_eq!(books[0].title, "Genesis");
        assert_eq!(books[0].book_type, "BibleBook");
    }

    #[test]
    fn test_strip_html_tags() {
        let input = r#"<strong class="verse_url"><a href="/x">Matt. 1 :1</a></strong> <strong class="verse_name">1:1</strong> <span class="upper_text">The</span> book"#;
        let result = strip_html_tags(input);
        assert_eq!(result, "Matt. 1 :1 1:1 The book");
    }
}
