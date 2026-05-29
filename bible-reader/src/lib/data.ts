export interface BookIndex {
  book_id: number;
  title: string;
  abbreviation: string;
  testament: string;
  url_segment: string;
  chapters_count: number;
}

export interface Marker {
  superscript: string;
  word: string;
  marker_type: "footnote" | "crossref";
}

export interface FootnoteDetail {
  anchor: string;
  verse_ref: string;
  superscript: string;
  word: string;
  text: string;
}

export interface Verse {
  number: number;
  text: string;
  markers: Marker[];
  footnotes: FootnoteDetail[];
}

export interface Chapter {
  book_id: number;
  book_title: string;
  book_abbreviation: string;
  testament: string;
  chapter_number: number;
  verses: Verse[];
}

let bookIndex: BookIndex[] | null = null;

export async function getBookIndex(): Promise<BookIndex[]> {
  if (bookIndex) return bookIndex;
  const res = await fetch("/data/index.json");
  bookIndex = await res.json();
  return bookIndex!;
}

export async function getBooksByTestament(testament: string): Promise<BookIndex[]> {
  const books = await getBookIndex();
  return books.filter((b) => b.testament === testament);
}

function abbrToDir(abbr: string): string {
  return abbr.toLowerCase().replace(/\./g, "").replace(/\s+/g, "-");
}

export async function getChapter(
  book: BookIndex,
  chapter: number
): Promise<Chapter> {
  const dir = abbrToDir(book.abbreviation);
  const testament = book.testament === "Old" ? "old-testament" : "new-testament";
  const url = `/data/${testament}/${dir}/${String(chapter).padStart(2, "0")}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Chapter not found: ${url}`);
  return res.json();
}
