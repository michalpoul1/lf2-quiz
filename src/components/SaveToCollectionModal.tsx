"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Collection,
  COLLECTION_COLORS,
  createCollection,
  getCollections,
  getCollectionsContaining,
  setQuestionCollections,
} from "@/lib/collections";

interface Props {
  open: boolean;
  subject: string;
  questionId: number | string;
  onClose: () => void;
  /** Called after the modal saves; receives the new "is saved anywhere" state. */
  onSaved?: (isSaved: boolean) => void;
}

export default function SaveToCollectionModal({
  open,
  subject,
  questionId,
  onClose,
  onSaved,
}: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creatingName, setCreatingName] = useState("");
  const [creatingColor, setCreatingColor] = useState<string>(
    COLLECTION_COLORS[0]
  );
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Load + initialize selection whenever the modal opens for a question
  useEffect(() => {
    if (!open) return;
    const cs = getCollections();
    setCollections(cs);
    setSelected(new Set(getCollectionsContaining(subject, questionId)));
    setCreatingName("");
    setCreatingColor(COLLECTION_COLORS[0]);
    setMounted(true);
    // Trigger slide-up animation on next frame
    requestAnimationFrame(() => setVisible(true));
  }, [open, subject, questionId]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => {
    setVisible(false);
    setTimeout(() => {
      setMounted(false);
      onClose();
    }, 200);
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    const name = creatingName.trim();
    if (!name) return;
    const c = createCollection(name, creatingColor);
    setCollections((prev) => [...prev, c]);
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(c.id);
      return next;
    });
    setCreatingName("");
  };

  const handleSave = () => {
    setQuestionCollections(subject, questionId, Array.from(selected));
    onSaved?.(selected.size > 0);
    // Find the name of the first selected collection for the toast
    const savedTo = collections.find((c) => selected.has(c.id));
    const toastMsg = savedTo
      ? `Uloženo do ${savedTo.name}`
      : selected.size > 0
        ? "Uloženo"
        : "Odebráno ze záložek";
    close();
    // Show toast after modal closes
    setToast(toastMsg);
    setTimeout(() => setToast(null), 2000);
  };

  const sortedCollections = useMemo(
    () => [...collections].sort((a, b) => a.name.localeCompare(b.name, "cs")),
    [collections]
  );

  if (!mounted && !toast) return null;

  return (
    <>
    {/* Toast notification */}
    {toast && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium rounded-xl shadow-lg animate-fade-in-up">
        {toast}
      </div>
    )}

    {mounted && (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={close}
      />

      {/* Sheet */}
      <div
        className={`relative w-full sm:max-w-md sm:mx-4 bg-white dark:bg-[#1e293b] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col transition-transform duration-200 ${
          visible ? "translate-y-0" : "translate-y-full sm:translate-y-4"
        }`}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-primary)] dark:text-blue-400">
            Uložit do kolekce
          </h2>
          <button
            type="button"
            onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 tap-highlight transition-colors"
            aria-label="Zavřít"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {sortedCollections.length === 0 ? (
            <p className="text-sm text-gray-500 mb-4">
              Vytvořte si první kolekci pro organizaci otázek
            </p>
          ) : (
            <div className="space-y-2 mb-5">
              {sortedCollections.map((c) => {
                const isSel = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleSelected(c.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 tap-highlight transition-colors text-left ${
                      isSel
                        ? "border-[var(--color-primary)] bg-blue-50 dark:bg-blue-950/30"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a]"
                    }`}
                  >
                    <span
                      className="w-1.5 h-9 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {c.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {c.questions.length} otázek
                      </div>
                    </div>
                    <div
                      className={`flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                        isSel
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {isSel && (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {sortedCollections.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 -mx-5 px-5 pt-4" />
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
              Nová kolekce
            </h3>
            <input
              type="text"
              value={creatingName}
              onChange={(e) => setCreatingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
              placeholder="Název nové kolekce..."
              className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f172a] focus:outline-none focus:border-[var(--color-primary)] mb-3"
            />
            <div className="flex flex-wrap gap-2 mb-3">
              {COLLECTION_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Barva ${color}`}
                  onClick={() => setCreatingColor(color)}
                  className={`w-8 h-8 rounded-full transition-transform tap-highlight ${
                    creatingColor === color
                      ? "ring-2 ring-offset-2 ring-[var(--color-primary)] dark:ring-offset-[#1e293b] scale-110"
                      : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!creatingName.trim()}
              className={`w-full font-medium py-2.5 rounded-xl text-sm tap-highlight transition-colors ${
                creatingName.trim()
                  ? "bg-blue-50 dark:bg-blue-950/30 text-[var(--color-primary)] dark:text-blue-400 active:opacity-70"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
              }`}
            >
              Vytvořit a vybrat
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex gap-2 safe-area-bottom">
          <button
            type="button"
            onClick={close}
            className="flex-1 py-3 rounded-xl font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 tap-highlight active:opacity-80"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-[var(--color-primary)] tap-highlight active:opacity-80"
          >
            Uložit
          </button>
        </div>
      </div>
    </div>
    )}
    </>
  );
}
