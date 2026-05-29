mod fetcher;
mod output;
mod types;

use crate::fetcher::*;
use crate::output::*;
use crate::types::*;
use anyhow::Result;
use clap::Parser;
use indicatif::{ProgressBar, ProgressStyle};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Semaphore;

/// Extract the Recovery Version Bible from bibleread.online,
/// with full footnotes and cross-references.
#[derive(Parser, Debug)]
#[command(name = "bible-extractor", version, about)]
struct Args {
    /// Output directory for data files
    #[arg(short, long, default_value = "data")]
    output: PathBuf,

    /// Delay in milliseconds between requests to the same host
    #[arg(short, long, default_value_t = 250)]
    delay_ms: u64,

    /// Maximum concurrent requests
    #[arg(short, long, default_value_t = 4)]
    concurrency: usize,

    /// Only extract this book (by url segment, e.g. "genesis")
    #[arg(short, long)]
    book: Option<String>,

    /// Only extract this testament ("Old" or "New")
    #[arg(short, long)]
    testament: Option<String>,

    /// Skip chapters that already exist on disk (resume mode)
    #[arg(long, default_value_t = true)]
    resume: bool,

    /// Do NOT skip existing chapters (re-download everything)
    #[arg(long)]
    no_resume: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    let resume = args.resume && !args.no_resume;

    // Step 1: Fetch books
    eprintln!("=== Fetching book list ===");
    let mut books = fetch_books().await?;
    eprintln!("  Found {} Bible books", books.len());

    // Filter by testament if requested
    if let Some(ref t) = args.testament {
        books.retain(|b| b.testament == *t);
        eprintln!("  Filtered to {} books (testament: {t})", books.len());
    }

    // Filter by book if requested
    if let Some(ref b) = args.book {
        books.retain(|bk| bk.url_segment == *b);
        eprintln!("  Filtered to book: {b}");
    }

    // Step 2: Fetch chapter metadata
    eprintln!("=== Fetching chapter metadata ===");
    let chapters = fetch_chapters().await?;
    eprintln!("  Found {} total chapters", chapters.len());

    // Build book_id -> chapter list map
    let mut book_chapters: HashMap<u64, Vec<ChapterMeta>> = HashMap::new();
    for ch in &chapters {
        book_chapters.entry(ch.book_id).or_default().push(ch.clone());
    }

    // Set up output directories
    let dirs = OutputDirs::create(&args.output)?;
    write_index(&books, &dirs)?;

    // Build the work queue: (book, chapter)
    let mut work: Vec<(BibleBook, ChapterMeta)> = Vec::new();
    for book in &books {
        if let Some(book_chs) = book_chapters.get(&book.id) {
            for ch in book_chs {
                work.push((book.clone(), ch.clone()));
            }
        }
    }

    eprintln!("=== Extracting {} chapters ===", work.len());

    let pb = Arc::new(ProgressBar::new(work.len() as u64));
    pb.set_style(
        ProgressStyle::default_bar()
            .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} ({eta}) {msg}")
            .unwrap()
            .progress_chars("#>-"),
    );

    let semaphore = Arc::new(Semaphore::new(args.concurrency));
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let mut handles = Vec::new();

    for (book, chapter_meta) in work {
        let permit = semaphore.clone().acquire_owned().await?;
        let pb = pb.clone();
        let client = client.clone();
        let dirs_data = args.output.clone();
        let delay = args.delay_ms;

        let handle = tokio::spawn(async move {
            let _permit = permit; // hold until done

            // Check resume
            if resume {
                let ch = Chapter {
                    book_id: book.id,
                    book_title: book.title.clone(),
                    book_abbreviation: book.abbreviation.clone(),
                    testament: book.testament.clone(),
                    chapter_number: chapter_meta.number,
                    verses: Vec::new(),
                };
                let dirs = OutputDirs::create(&dirs_data).unwrap();
                if chapter_exists(&ch, &dirs) {
                    pb.inc(1);
                    pb.set_message(format!(
                        "skip {} {}",
                        book.abbreviation, chapter_meta.number
                    ));
                    return;
                }
            }

            pb.set_message(format!(
                "{} {}",
                book.abbreviation, chapter_meta.number
            ));

            // Retry up to 3 times for transient errors
            let mut chapter_result = Err(anyhow::anyhow!("unreachable"));
            for attempt in 1..=3 {
                chapter_result = extract_chapter(&client, &book, &chapter_meta, delay).await;
                if chapter_result.is_ok() {
                    break;
                }
                if attempt < 3 {
                    let backoff = delay * (2u64.pow(attempt));
                    pb.set_message(format!(
                        "retry {} {} (attempt {}/3)",
                        book.abbreviation, chapter_meta.number, attempt + 1
                    ));
                    tokio::time::sleep(std::time::Duration::from_millis(backoff)).await;
                }
            }

            match chapter_result {
                Ok(chapter) => {
                    let dirs = OutputDirs::create(&dirs_data).unwrap();
                    if let Err(e) = write_chapter(&chapter, &dirs) {
                        eprintln!(
                            "  Error writing {} {}: {e}",
                            book.abbreviation, chapter_meta.number
                        );
                    }
                }
                Err(e) => {
                    eprintln!(
                        "  Error extracting {} {}: {e}",
                        book.abbreviation, chapter_meta.number
                    );
                }
            }

            pb.inc(1);
        });

        handles.push(handle);
    }

    // Wait for all tasks
    for handle in handles {
        let _ = handle.await;
    }

    pb.finish_with_message("Done!");
    eprintln!("=== Extraction complete ===");
    eprintln!("Data written to: {}", args.output.display());

    // Build combined output files
    eprintln!("=== Building combined Bible files ===");
    let dirs = OutputDirs::create(&args.output)?;
    if let Err(e) = output::write_combined(&dirs) {
        eprintln!("  Error writing combined files: {e}");
    }

    Ok(())
}

async fn extract_chapter(
    client: &reqwest::Client,
    book: &BibleBook,
    chapter_meta: &ChapterMeta,
    delay_ms: u64,
) -> Result<Chapter> {
    let book_segment = &book.url_segment;
    let chapter_num = chapter_meta.number;

    // Fetch chapter page (verses + markers)
    let chapter_url = format!(
        "https://bibleread.online/bible/{book_segment}/{chapter_num}/"
    );
    let html = client
        .get(&chapter_url)
        .send()
        .await?
        .text()
        .await?;

    let mut verses = parse_chapter_html(&html, chapter_num)?;

    // Small delay between fetches
    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;

    // Fetch note page (footnote details)
    let note_url = format!(
        "https://bibleread.online/note/{book_segment}/{chapter_num}/"
    );
    match client.get(&note_url).send().await {
        Ok(resp) => {
            let note_html = resp.text().await?;
            let footnote_map = parse_note_html(&note_html)?;
            merge_footnotes(&mut verses, &footnote_map, chapter_num);
        }
        Err(e) => {
            eprintln!(
                "  Warning: no notes for {} {} ({e})",
                book.abbreviation, chapter_num
            );
        }
    }

    Ok(Chapter {
        book_id: book.id,
        book_title: book.title.clone(),
        book_abbreviation: book.abbreviation.clone(),
        testament: book.testament.clone(),
        chapter_number: chapter_num,
        verses,
    })
}
