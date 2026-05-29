"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookIndex, getBookIndex } from "@/lib/data";

export function Sidebar() {
  const [books, setBooks] = useState<BookIndex[]>([]);
  const [testament, setTestament] = useState<"Old" | "New">("Old");
  const [open, setOpen] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    getBookIndex().then(setBooks);
  }, []);

  const otBooks = books.filter((b) => b.testament === "Old");
  const ntBooks = books.filter((b) => b.testament === "New");
  const current = testament === "Old" ? otBooks : ntBooks;

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-3 left-3 z-50 lg:hidden bg-stone-800 text-white px-3 py-1.5 rounded text-sm"
      >
        {open ? "✕" : "☰"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed lg:static z-40 top-0 left-0 h-full w-64 bg-stone-900 text-stone-200 flex flex-col shrink-0 overflow-hidden shadow-xl"
          >
            <div className="p-4 border-b border-stone-700">
              <Link href="/" className="text-lg font-semibold tracking-tight hover:text-white transition-colors">
                The Bible
              </Link>
              <p className="text-xs text-stone-400 mt-0.5">Recovery Version</p>
            </div>

            {/* Testament tabs */}
            <div className="flex border-b border-stone-700">
              {(["Old", "New"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTestament(t)}
                  className={`flex-1 py-2 text-xs font-medium tracking-wide uppercase transition-colors ${
                    testament === t
                      ? "bg-stone-700 text-white"
                      : "text-stone-400 hover:text-stone-200"
                  }`}
                >
                  {t} Testament
                </button>
              ))}
            </div>

            {/* Book list */}
            <nav className="flex-1 overflow-y-auto py-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={testament}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {current.map((book) => {
                    const isActive = pathname.startsWith(`/book/${book.abbreviation.toLowerCase().replace(/[.\s]/g, "-").replace(/-+$/, "")}`);
                    return (
                      <Link
                        key={book.book_id}
                        href={`/book/${book.abbreviation.toLowerCase().replace(/[.\s]/g, "-").replace(/-+$/, "")}`}
                        className={`block px-4 py-1.5 text-sm transition-colors ${
                          isActive
                            ? "bg-stone-700 text-white font-medium"
                            : "text-stone-400 hover:text-stone-100 hover:bg-stone-800"
                        }`}
                      >
                        <span className="text-xs text-stone-500 mr-2 w-5 inline-block text-right">
                          {book.abbreviation.replace(/\.$/, "")}
                        </span>
                        {book.title.length > 24
                          ? book.title.slice(0, 24) + "…"
                          : book.title}
                      </Link>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </nav>

            <div className="p-3 border-t border-stone-700 text-[10px] text-stone-500 text-center">
              {otBooks.length + ntBooks.length} books · Recovery Version
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
