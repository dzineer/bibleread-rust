"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookIndex,
  Chapter,
  Verse,
  FootnoteDetail,
  getBookIndex,
  getChapter,
} from "@/lib/data";
import { useTTS } from "@/lib/useTTS";

function abbrSlug(abbr: string) {
  return abbr.toLowerCase().replace(/[.\s]/g, "-").replace(/-+$/, "");
}

function isFootnote(superscript: string): boolean {
  return /^\d/.test(superscript);
}

export default function ChapterPage() {
  const { slug, chapter } = useParams<{ slug: string; chapter: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookIndex | null>(null);
  const [data, setData] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinnedNote, setPinnedNote] = useState<FootnoteDetail | null>(null);
  const [hoveredNote, setHoveredNote] = useState<FootnoteDetail | null>(null);
  const [notePos, setNotePos] = useState({ x: 0, y: 0 });

  const chNum = parseInt(chapter);
  const activeNote = pinnedNote ?? hoveredNote;

  // TTS
  const verseTexts =
    data?.verses.map((v) => ({ number: v.number, text: v.text })) ?? [];
  const tts = useTTS(verseTexts);

  useEffect(() => {
    getBookIndex().then((books) => {
      const found = books.find((b) => abbrSlug(b.abbreviation) === slug);
      if (found) {
        setBook(found);
        getChapter(found, chNum).then((d) => {
          setData(d);
          setLoading(false);
        });
      }
    });
  }, [slug, chNum]);

  const goTo = useCallback(
    (delta: number) => {
      if (!book) return;
      const next = chNum + delta;
      if (next >= 1 && next <= book.chapters_count) {
        router.push(`/book/${slug}/${next}`);
      }
    },
    [chNum, book, slug, router]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo(-1);
      if (e.key === "ArrowRight") goTo(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goTo]);

  // Close popover on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinnedNote(null);
        setHoveredNote(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!book || loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-full pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-stone-50/90 backdrop-blur border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <div>
          <Link
            href={`/book/${slug}`}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            {book.abbreviation.replace(/\.$/, "")}
          </Link>
          <h2 className="text-lg font-semibold text-stone-900">
            Chapter {chNum}
          </h2>
        </div>

        {/* TTS controls */}
        {tts.supported && (
          <div className="flex items-center gap-2">
            {/* Voice selector */}
            {tts.voices.length > 0 && (
              <select
                value={tts.selectedVoice}
                onChange={(e) => tts.setSelectedVoice(e.target.value)}
                className="text-xs bg-stone-100 border border-stone-200 rounded-lg px-2 py-1.5 text-stone-600 max-w-[120px] truncate"
              >
                {tts.voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.premium ? "✦ " : ""}{v.name} ({v.lang})
                  </option>
                ))}
              </select>
            )}
            {!tts.playing ? (
              <button
                onClick={tts.play}
                className="px-3 py-1.5 text-sm rounded-lg bg-stone-800 text-white hover:bg-stone-700 transition-all flex items-center gap-1.5 shrink-0"
                title="Read aloud"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                Read
              </button>
            ) : (
              <>
                <button
                  onClick={tts.pause}
                  className="px-3 py-1.5 text-sm rounded-lg bg-amber-500 text-white hover:bg-amber-400 transition-all flex items-center gap-1.5 shrink-0"
                  title="Pause"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  Pause
                </button>
                <button
                  onClick={tts.stop}
                  className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 bg-white hover:bg-stone-100 transition-all shrink-0"
                  title="Stop"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                </button>
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => goTo(-1)}
            disabled={chNum <= 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-30 transition-all"
          >
            ← Prev
          </button>
          <span className="text-xs text-stone-400 px-2">
            {chNum}/{book.chapters_count}
          </span>
          <button
            onClick={() => goTo(1)}
            disabled={chNum >= book.chapters_count}
            className="px-3 py-1.5 text-sm rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-30 transition-all"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Verses */}
      <AnimatePresence mode="wait">
        <motion.div
          key={chNum}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
          className="max-w-2xl mx-auto px-4 md:px-0 py-6"
        >
          {data?.verses.map((verse, i) => (
            <motion.div
              key={verse.number}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.015, duration: 0.25 }}
            >
              <VerseBlock
                verse={verse}
                isReading={tts.currentVerse === verse.number}
                onFootnoteHover={(note, el) => {
                  const rect = el.getBoundingClientRect();
                  setNotePos({ x: rect.left, y: rect.bottom + 4 });
                  setHoveredNote(note);
                }}
                onFootnoteLeave={() => {
                  setHoveredNote(null);
                }}
                onFootnoteClick={(note, el) => {
                  const rect = el.getBoundingClientRect();
                  setNotePos({ x: rect.left, y: rect.bottom + 4 });
                  setPinnedNote(
                    pinnedNote?.anchor === note.anchor ? null : note
                  );
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Footnote popover */}
      <AnimatePresence>
        {activeNote && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`fixed z-50 max-w-sm rounded-xl shadow-2xl text-sm leading-relaxed overflow-hidden ${
              isFootnote(activeNote.superscript)
                ? "bg-blue-950 border-l-4 border-blue-400"
                : "bg-purple-950 border-l-4 border-purple-400"
            }`}
            style={{
              left: Math.min(notePos.x, window.innerWidth - 360),
              top: notePos.y,
            }}
          >
            {/* Header bar */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-mono font-bold ${
                  isFootnote(activeNote.superscript)
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-purple-500/20 text-purple-300"
                }`}
              >
                {activeNote.superscript}
              </span>
              <span className="text-xs text-stone-400 font-medium">
                {activeNote.word}
              </span>
              <span className="ml-auto text-[10px] text-stone-500 font-mono">
                {activeNote.verse_ref}
              </span>
              {pinnedNote && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedNote(null);
                  }}
                  className="text-stone-500 hover:text-stone-300 text-xs ml-1"
                  title="Close (Esc)"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Body */}
            <div
              className="px-4 pb-4 text-stone-200 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_a]:text-blue-300 [&_a]:underline [&_i]:italic"
              dangerouslySetInnerHTML={{ __html: activeNote.text }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 bg-stone-50/90 backdrop-blur border-t border-stone-200 px-4 py-2 flex justify-between">
        <button
          onClick={() => goTo(-1)}
          disabled={chNum <= 1}
          className="px-4 py-1.5 text-sm rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-30 transition-all"
        >
          ← Previous
        </button>
        <button
          onClick={() => goTo(1)}
          disabled={chNum >= book.chapters_count}
          className="px-4 py-1.5 text-sm rounded-lg border border-stone-200 bg-white hover:bg-stone-100 disabled:opacity-30 transition-all"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

type TextSegment =
  | { type: "text"; value: string }
  | { type: "marker"; superscript: string; note: FootnoteDetail | null; key: string };

function buildSegments(verse: Verse): TextSegment[] {
  const text = verse.text;
  const markers = [...verse.markers];
  const footnoteMap = new Map(verse.footnotes.map((f) => [f.superscript, f]));

  if (markers.length === 0) {
    return [{ type: "text", value: text }];
  }

  interface MarkerPos {
    index: number;
    superscript: string;
    word: string;
  }

  const positions: MarkerPos[] = [];
  const remaining = [...markers];
  let searchFrom = 0;

  while (remaining.length > 0) {
    let bestMatch: { idx: number; m: (typeof remaining)[0] } | null = null;

    for (const m of remaining) {
      const idx = text.indexOf(m.word, searchFrom);
      if (idx !== -1 && (bestMatch === null || idx < bestMatch.idx)) {
        bestMatch = { idx, m };
      }
    }

    if (bestMatch === null) break;

    positions.push({
      index: bestMatch.idx,
      superscript: bestMatch.m.superscript,
      word: bestMatch.m.word,
    });

    remaining.splice(
      remaining.findIndex(
        (m) =>
          m.superscript === bestMatch!.m.superscript &&
          m.word === bestMatch!.m.word
      ),
      1
    );
    searchFrom = bestMatch.idx + bestMatch.m.word.length;
  }

  positions.sort((a, b) => a.index - b.index);

  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const pos of positions) {
    if (pos.index > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, pos.index) });
    }
    const key = `${verse.number}_${pos.superscript}_${pos.index}`;
    segments.push({
      type: "marker",
      superscript: pos.superscript,
      note: footnoteMap.get(pos.superscript) ?? null,
      key,
    });
    cursor = pos.index + pos.word.length;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }

  return segments;
}

function VerseBlock({
  verse,
  isReading,
  onFootnoteHover,
  onFootnoteLeave,
  onFootnoteClick,
}: {
  verse: Verse;
  isReading: boolean;
  onFootnoteHover: (note: FootnoteDetail, el: HTMLElement) => void;
  onFootnoteLeave: () => void;
  onFootnoteClick: (note: FootnoteDetail, el: HTMLElement) => void;
}) {
  const segments = buildSegments(verse);

  return (
    <div
      className={`group py-2 px-3 -mx-3 rounded-lg transition-all duration-300 ${
        isReading
          ? "bg-amber-50 ring-1 ring-amber-200 shadow-sm scale-[1.01]"
          : "hover:bg-stone-100/50"
      }`}
    >
      <div className="flex gap-3">
        <span className="text-xs text-stone-300 font-mono mt-1 shrink-0 w-5 text-right select-none">
          {verse.number}
        </span>
        <p className="text-base leading-relaxed text-stone-800">
          {segments.map((seg, i) => {
            if (seg.type === "text") {
              return <span key={`t${i}`}>{seg.value}</span>;
            }
            const fn = isFootnote(seg.superscript);
            return seg.note ? (
              <button
                key={seg.key}
                onMouseEnter={(e) =>
                  onFootnoteHover(seg.note!, e.currentTarget)
                }
                onMouseLeave={onFootnoteLeave}
                onClick={(e) => onFootnoteClick(seg.note!, e.currentTarget)}
                className={`text-[11px] font-mono align-super leading-none transition-colors ${
                  fn
                    ? "text-blue-500 hover:text-blue-700"
                    : "text-purple-500 hover:text-purple-700"
                }`}
              >
                {seg.superscript}
              </button>
            ) : (
              <sup
                key={seg.key}
                className={`text-[11px] font-mono ${
                  fn ? "text-blue-400" : "text-purple-400"
                }`}
              >
                {seg.superscript}
              </sup>
            );
          })}
        </p>
      </div>
    </div>
  );
}
