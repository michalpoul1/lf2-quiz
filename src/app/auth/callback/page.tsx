"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("Přihlašuji…");

  useEffect(() => {
    let cancelled = false;

    const goError = (message: string) => {
      if (cancelled) return;
      router.replace(`/login?error=${encodeURIComponent(message)}`);
    };

    (async () => {
      if (!isSupabaseConfigured()) {
        goError("Supabase není nakonfigurovaný (chybí env proměnné).");
        return;
      }
      const supabase = getSupabase();

      try {
        // PKCE flow — magic-link with ?code=… in the query string.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errParam = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (errParam) {
          goError(errParam);
          return;
        }
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            goError(`Ověření selhalo: ${error.message}`);
            return;
          }
        }

        // Implicit flow: session tokens land in #access_token=… fragment.
        // The Supabase JS client picks them up automatically via
        // detectSessionInUrl. Give it a tick to settle, then check.
        for (let i = 0; i < 20; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            if (cancelled) return;
            router.replace("/");
            return;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        goError("Přihlášení se nepodařilo dokončit. Zkuste to prosím znovu.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        goError(`Chyba: ${msg}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="pt-10 pb-6 text-center fade-in">
      <div className="inline-block w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{status}</p>
    </main>
  );
}
