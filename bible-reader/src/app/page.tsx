"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookIndex, getBookIndex } from "@/lib/data";

function abbrSlug(abbr: string) {
  return abbr.toLowerCase().replace(/[.\s]/g, "-").replace(/-+$/, "");
}

export default function Home() {
  const [books, setBooks] = useState<BookIndex[]>([]);
  const [activeTab, setActiveTab] = useState<"Old" | "New">("Old");

  useEffect(() => {
    getBookIndex().then(setBooks);
  }, []);

  const filtered = books.filter((b) => b.testament === activeTab);
  const otCount = books.filter((b) => b.testament === "Old").length;
  const ntCount = books.filter((b) => b.testament === "New").length;

  return (
    <div className="min-h-full p-6 md:p-10 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-stone-900">
          The Holy Bible
        </h1>
        <p className="text-stone-500 mt-1 text-lg">Recovery Version — with footnotes</p>
      </motion.div>

      {/* Testament tabs */}
      <div className="flex gap-1 mt-8 bg-stone-200/50 p-1 rounded-xl w-fit">
        {(["Old", "New"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t ? "text-white" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {activeTab === t && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 bg-stone-800 rounded-lg"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">
              {t} Testament ({t === "Old" ? otCount : ntCount})
            </span>
          </button>
        ))}
      </div>

      {/* Book grid */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
      >
        {filtered.map((book, i) => (
          <motion.div
            key={book.book_id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03, duration: 0.3 }}
          >
            <Link
              href={`/book/${abbrSlug(book.abbreviation)}`}
              className="block p-4 bg-white rounded-xl border border-stone-200 hover:border-stone-400 hover:shadow-md transition-all group"
            >
              <div className="text-xs text-stone-400 font-mono mb-1">
                {book.abbreviation.replace(/\.$/, "")}
              </div>
              <div className="text-sm font-medium text-stone-800 group-hover:text-stone-950 leading-snug">
                {book.title}
              </div>
              <div className="text-xs text-stone-400 mt-2">
                {book.chapters_count} chapters
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
