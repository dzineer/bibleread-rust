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

function abbrSlug(abbr: string) {
  return abbr.toLowerCase().replace(/[.\s]/g, "-").replace(/-+$/, "");
}

export default function ChapterPage() {
  const { slug, chapter } = useParams<{ slug: string; chapter: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookIndex | null>(null);
  const [data, setData] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState<FootnoteDetail | null>(null);
  const [notePos, setNotePos] = useState({ x: 0, y: 0 });

  const chNum = parseInt(chapter);

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
                onFootnoteClick={(note, el) => {
                  const rect = el.getBoundingClientRect();
                  setNotePos({ x: rect.left, y: rect.bottom + 4 });
                  setActiveNote(activeNote?.anchor === note.anchor ? null : note);
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
            className="fixed z-50 max-w-sm bg-stone-800 text-stone-100 rounded-xl shadow-2xl p-4 text-sm leading-relaxed"
            style={{
              left: Math.min(notePos.x, window.innerWidth - 360),
              top: notePos.y,
            }}
            onClick={() => setActiveNote(null)}
          >
            <div className="flex items-center gap-2 mb-2 text-stone-400 text-xs">
              <span className="bg-stone-700 px-1.5 py-0.5 rounded font-mono">
                {activeNote.superscript}
              </span>
              <span className="font-medium text-stone-300">
                {activeNote.word}
              </span>
              <span className="ml-auto">{activeNote.verse_ref}</span>
            </div>
            <div
              className="text-stone-200"
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

function VerseBlock({
  verse,
  onFootnoteClick,
}: {
  verse: Verse;
  onFootnoteClick: (note: FootnoteDetail, el: HTMLElement) => void;
}) {
  return (
    <div className="group py-2 px-3 -mx-3 rounded-lg hover:bg-stone-100/50 transition-colors">
      <div className="flex gap-3">
        <span className="text-xs text-stone-300 font-mono mt-1 shrink-0 w-5 text-right select-none">
          {verse.number}
        </span>
        <div>
          <p className="text-base leading-relaxed text-stone-800">
            {verse.text}
          </p>
          {verse.footnotes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {verse.footnotes.map((note) => (
                <button
                  key={note.anchor}
                  onClick={(e) => onFootnoteClick(note, e.currentTarget)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-200/70 hover:bg-stone-300/80 text-[11px] text-stone-500 font-mono transition-colors"
                >
                  {note.superscript}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
