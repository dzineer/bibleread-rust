use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A book of the Bible as embedded in the HTML page.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct BibleBook {
    pub id: u64,
    pub title: String,
    pub abbreviation: String,
    #[serde(rename = "fullName")]
    pub full_name: String,
    #[serde(rename = "shortName")]
    pub short_name: String,
    #[serde(rename = "bookType")]
    pub book_type: String,
    #[serde(rename = "urlSegment")]
    pub url_segment: String,
    pub number: u32,
    pub group: u32,
    pub testament: String,
    #[serde(rename = "chaptersCount")]
    pub chapters_count: u32,
}

/// Response from /app/getChapters/
#[derive(Debug, Clone, Deserialize)]
pub struct ChaptersResponse {
    pub chapters: Vec<ChapterMeta>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChapterMeta {
    #[allow(dead_code)]
    pub id: u64,
    #[serde(rename = "bookId")]
    pub book_id: u64,
    pub number: u32,
}

/// Parsed verse data from a chapter page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Verse {
    pub number: u32,
    pub text: String,
    pub markers: Vec<Marker>,
    pub footnotes: Vec<FootnoteDetail>,
}

/// A footnote/cross-reference marker found in the verse text.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Marker {
    /// The superscript text: "1", "a", "2b", "3c", etc.
    pub superscript: String,
    /// The word this marker is attached to.
    pub word: String,
    /// Whether this is a footnote (numeric-first) or cross-reference (letter-only).
    pub marker_type: MarkerType,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MarkerType {
    Footnote,
    CrossRef,
}

/// Full footnote/cross-reference detail from the note page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FootnoteDetail {
    /// The anchor in format "chapter_verse_marker" e.g. "1_1_1", "1_1_a"
    pub anchor: String,
    /// The verse reference shown (e.g. "1:1")
    pub verse_ref: String,
    /// The superscript text (e.g. "1", "a", "2b")
    pub superscript: String,
    /// The word/phrase this note is attached to
    pub word: String,
    /// The full footnote/cross-ref text (HTML stripped)
    pub text: String,
}

/// A complete chapter with all data merged.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub book_id: u64,
    pub book_title: String,
    pub book_abbreviation: String,
    pub testament: String,
    pub chapter_number: u32,
    pub verses: Vec<Verse>,
}

/// Master index entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexEntry {
    pub book_id: u64,
    pub title: String,
    pub abbreviation: String,
    pub testament: String,
    pub url_segment: String,
    pub chapters_count: u32,
}

/// Map from anchor -> FootnoteDetail for fast lookup during merge.
pub type FootnoteMap = HashMap<String, FootnoteDetail>;
