"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const params = useSearchParams();
  const [flashError, setFlashError] = useState<string>("");

  useEffect(() => {
    const err = params.get("error");
    if (err) setFlashError(err);
  }, [params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFlashError("");
    const trimmed = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setStatus({ kind: "error", message: "Zadejte platný email." });
      return;
    }
    if (!isSupabaseConfigured()) {
      setStatus({
        kind: "error",
        message: "Supabase není nakonfigurovaný (chybí env proměnné).",
      });
      return;
    }
    setStatus({ kind: "sending" });
    try {
      const supabase = getSupabase();
      const emailRedirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo },
      });
      if (error) {
        setStatus({ kind: "error", message: error.message });
        return;
      }
      setStatus({ kind: "sent" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message: `Nepodařilo se odeslat email: ${msg}` });
    }
  };

  return (
    <>
      {flashError && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-3 mb-4 text-sm text-[var(--color-wrong)]">
          {flashError}
        </div>
      )}

      <form onSubmit={submit} className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Email
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status.kind === "sending" || status.kind === "sent"}
            placeholder="vas@email.cz"
            className="mt-1 w-full px-3 py-2.5 rounded-lg text-sm bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-50"
          />
        </label>

        <button
          type="submit"
          disabled={status.kind === "sending" || status.kind === "sent"}
          className="w-full px-4 py-3 rounded-lg text-sm font-semibold bg-[var(--color-primary)] text-white tap-highlight active:opacity-80 transition-opacity disabled:opacity-50"
        >
          {status.kind === "sending" ? "Odesílám…" : "Poslat přihlašovací odkaz"}
        </button>

        {status.kind === "sent" && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3 text-sm text-[var(--color-correct)]">
            Zkontrolujte svůj email a klikněte na odkaz. Odkaz vás vrátí zpět
            do aplikace.
          </div>
        )}
        {status.kind === "error" && (
          <p className="text-sm text-[var(--color-wrong)]">{status.message}</p>
        )}
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="pt-6 pb-6 fade-in">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-gray-500 mb-6 tap-highlight"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Zpět
      </Link>

      <h1 className="text-2xl font-bold text-[var(--color-primary)] dark:text-blue-400 mb-1">
        Přihlášení
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Zadejte svůj email a pošleme vám přihlašovací odkaz.
      </p>

      <Suspense fallback={<div className="text-sm text-gray-400">Načítám…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
