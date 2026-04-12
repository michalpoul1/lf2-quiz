"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Collection,
  COLLECTION_COLORS,
  deleteCollection,
  getCollections,
  pinCollection,
  renameCollection,
  setCollectionColor,
  unpinCollection,
} from "@/lib/collections";

const SUBJECT_SHORT: Record<string, string> = {
  biology: "Bio",
  chemistry: "Chem",
  physics: "Fyz",
};

interface CollectionStats {
  total: number;
  perSubject: Record<string, number>;
}

function statsFor(c: Collection): CollectionStats {
  const perSubject: Record<string, number> = {};
  for (const q of c.questions) {
    perSubject[q.subject] = (perSubject[q.subject] || 0) + 1;
  }
  return { total: c.questions.length, perSubject };
}

export default function BookmarksPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const reload = () => setCollections(getCollections());

  useEffect(() => {
    reload();
    setLoaded(true);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // Compute unique question count from state (NOT from localStorage) so that
  // server and client first render produce the same HTML.
  const totalUnique = useMemo(() => {
    const seen = new Set<string>();
    for (const c of collections) {
      for (const q of c.questions) {
        seen.add(`${q.subject}::${q.questionId}`);
      }
    }
    return seen.size;
  }, [collections]);

  const handleRename = (id: string) => {
    const name = renameValue.trim();
    if (name) renameCollection(id, name);
    setRenamingId(null);
    setRenameValue("");
    reload();
  };

  const handleColor = (id: string, color: string) => {
    setCollectionColor(id, color);
    setColorPickerId(null);
    setMenuOpen(null);
    reload();
  };

  const handlePin = (id: string, pin: boolean) => {
    if (pin) pinCollection(id);
    else unpinCollection(id);
    setMenuOpen(null);
    reload();
  };

  const handleDelete = (id: string) => {
    deleteCollection(id);
    setConfirmDeleteId(null);
    setMenuOpen(null);
    reload();
  };

  // While not yet hydrated, render a static skeleton that matches server output.
  if (!loaded) {
    return (
      <main className="pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-1">
          Záložky
        </h1>
        <p className="text-sm text-gray-500 mb-5">Načítání...</p>
        <div className="space-y-3">
          <div className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
          <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="pt-6 pb-4 fade-in">
      <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-1">
        Záložky
      </h1>
      <p className="text-sm text-gray-500 mb-5">
        {collections.length > 0
          ? `${collections.length} ${collections.length === 1 ? "kolekce" : collections.length < 5 ? "kolekce" : "kolekcí"} • ${totalUnique} otázek`
          : "Žádné kolekce"}
      </p>

      {/* "All saved" virtual collection */}
      {totalUnique > 0 && (
        <Link
          href="/bookmarks/all"
          className="block bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-3 overflow-hidden tap-highlight active:opacity-80 transition-opacity"
        >
          <div className="flex items-stretch">
            <div className="w-1.5 bg-gradient-to-b from-blue-400 to-purple-500 flex-shrink-0" />
            <div className="flex-1 p-4 flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-[var(--color-primary)] dark:text-blue-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 11H5m14-4H5m14 8H5m14 4H5"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">Všechny uložené</div>
                <div className="text-xs text-gray-500">
                  {totalUnique} unikátních otázek
                </div>
              </div>
              <svg
                className="w-5 h-5 text-gray-300 dark:text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </Link>
      )}

      {collections.length === 0 && (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
            />
          </svg>
          <p className="text-gray-400 dark:text-gray-500 mb-1">
            Zatím nemáte žádné kolekce
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Vytvořte kolekci kliknutím na ikonu záložky při procvičování
          </p>
        </div>
      )}

      {/* User collections */}
      <div className="space-y-3">
        {[...collections]
          .sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            if (a.pinned && b.pinned)
              return (a.pinnedAt || "").localeCompare(b.pinnedAt || "");
            return (a.createdAt || "").localeCompare(b.createdAt || "");
          })
          .map((c) => {
          const s = statsFor(c);
          const isMenuOpen = menuOpen === c.id;
          const isRenaming = renamingId === c.id;
          const isColorPicking = colorPickerId === c.id;
          const isConfirmDelete = confirmDeleteId === c.id;
          return (
            <div
              key={c.id}
              className="relative bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-stretch">
                <div
                  className="w-1.5 flex-shrink-0 rounded-l-xl"
                  style={{ backgroundColor: c.color }}
                />
                <Link
                  href={`/bookmarks/collection?id=${c.id}`}
                  className="flex-1 p-4 tap-highlight active:opacity-80 transition-opacity min-w-0"
                >
                  {isRenaming ? (
                    <input
                      autoFocus
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.preventDefault()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(c.id);
                        if (e.key === "Escape") {
                          setRenamingId(null);
                          setRenameValue("");
                        }
                      }}
                      onBlur={() => handleRename(c.id)}
                      className="w-full font-bold text-base mb-1 px-2 py-1 -mx-2 -my-1 rounded border-2 border-[var(--color-primary)] bg-white dark:bg-[#0f172a] focus:outline-none"
                    />
                  ) : (
                    <div className="font-bold text-base truncate flex items-center gap-1.5">
                      {c.name}
                      {c.pinned && (
                        <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-0.5">
                    {s.total} otázek
                  </div>
                  {s.total > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {Object.entries(s.perSubject).map(([subj, n]) => (
                        <span
                          key={subj}
                          className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                        >
                          {SUBJECT_SHORT[subj] || subj}: {n}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => setMenuOpen(isMenuOpen ? null : c.id)}
                  className="flex-shrink-0 px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 tap-highlight"
                  aria-label="Menu kolekce"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 14a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
                  </svg>
                </button>
              </div>

              {/* Dropdown menu */}
              {isMenuOpen && !isColorPicking && !isConfirmDelete && (
                <div
                  ref={menuRef}
                  className="absolute right-2 bottom-full mb-1 z-50 bg-white dark:bg-[#0f172a] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1.5 min-w-[180px]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(c.id);
                      setRenameValue(c.name);
                      setMenuOpen(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 tap-highlight flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                    Přejmenovat
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorPickerId(c.id)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 tap-highlight flex items-center gap-2.5"
                  >
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    Změnit barvu
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePin(c.id, !c.pinned)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 tap-highlight flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill={c.pinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                    {c.pinned ? "Odepnout" : "Připnout"}
                  </button>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(c.id)}
                    className="w-full text-left px-4 py-2.5 text-sm text-[var(--color-wrong)] hover:bg-red-50 dark:hover:bg-red-950/30 tap-highlight flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Smazat kolekci
                  </button>
                </div>
              )}

              {/* Color picker popover */}
              {isColorPicking && (
                <div
                  ref={menuRef}
                  className="absolute right-2 bottom-full mb-1 z-50 bg-white dark:bg-[#0f172a] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-3"
                >
                  <p className="text-xs font-semibold text-gray-400 mb-2">Vyberte barvu</p>
                  <div className="flex flex-wrap gap-2 max-w-[200px]">
                    {COLLECTION_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleColor(c.id, color)}
                        className={`w-8 h-8 rounded-full tap-highlight transition-transform ${
                          c.color === color
                            ? "ring-2 ring-offset-2 ring-[var(--color-primary)] dark:ring-offset-[#0f172a] scale-110"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Barva ${color}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Delete confirmation */}
              {isConfirmDelete && (
                <div
                  ref={menuRef}
                  className="absolute right-2 bottom-full mb-1 z-50 bg-white dark:bg-[#0f172a] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 w-[260px]"
                >
                  <p className="text-sm mb-1">
                    Opravdu smazat kolekci <strong>{c.name}</strong>?
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Otázky nebudou smazány z jiných kolekcí.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteId(null);
                        setMenuOpen(null);
                      }}
                      className="flex-1 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 tap-highlight"
                    >
                      Zrušit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="flex-1 py-2 text-sm rounded-lg bg-[var(--color-wrong)] text-white tap-highlight"
                    >
                      Smazat
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
