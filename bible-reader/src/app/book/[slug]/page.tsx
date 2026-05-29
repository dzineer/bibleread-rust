"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookIndex, getBookIndex } from "@/lib/data";

function abbrSlug(abbr: string) {
  return abbr.toLowerCase().replace(/[.\s]/g, "-").replace(/-+$/, "");
}

export default function BookPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [book, setBook] = useState<BookIndex | null>(null);

  useEffect(() => {
    getBookIndex().then((books) => {
      const found = books.find((b) => abbrSlug(b.abbreviation) === slug);
      if (found) setBook(found);
    });
  }, [slug]);

  if (!book) {
    return (
      <div className="min-h-full flex items-center justify-center text-stone-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 md:p-10 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link
          href="/"
          className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          ← All Books
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-stone-900 mt-2">
          {book.title}
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          {book.testament} Testament · {book.chapters_count} chapters
        </p>
      </motion.div>

      {/* Chapter grid */}
      <div className="mt-6 grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 gap-2">
        {Array.from({ length: book.chapters_count }, (_, i) => i + 1).map((ch) => (
          <motion.button
            key={ch}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: ch * 0.01, duration: 0.2 }}
            onClick={() => router.push(`/book/${slug}/${ch}`)}
            className="aspect-square rounded-lg bg-white border border-stone-200 hover:border-stone-400 hover:bg-stone-50 hover:shadow-sm transition-all text-sm font-medium text-stone-700"
          >
            {ch}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
