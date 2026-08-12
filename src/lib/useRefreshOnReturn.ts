"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Re-run `callback` whenever the user returns to a page that reads from
 * localStorage, so counts and lists always reflect the latest data.
 *
 * Fires on:
 * - initial mount
 * - client-side navigation back to this page (pathname change)
 * - document `visibilitychange` when the tab becomes visible
 * - window `focus` (covers alt-tab and browser refocus)
 * - `storage` event (cross-tab changes to localStorage)
 *
 * The callback is stored in a ref so consumers can pass an inline arrow
 * without triggering the effect on every render.
 */
export function useRefreshOnReturn(callback: () => void): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const pathname = usePathname();

  useEffect(() => {
    // Run once on mount and whenever pathname changes (returning via
    // client-side nav from a deeper route re-triggers this because the
    // pathname string goes X → Y → X and the effect re-runs).
    cbRef.current();

    const onVisibility = () => {
      if (document.visibilityState === "visible") cbRef.current();
    };
    const onFocus = () => cbRef.current();
    const onStorage = () => cbRef.current();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [pathname]);
}
