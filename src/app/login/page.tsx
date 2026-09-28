"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

type Phase =
  | { kind: "idle" }
  | { kind: "sending-email" }
  | { kind: "awaiting-code" }
  | { kind: "verifying" }
  | { kind: "error"; message: string };

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [flashError, setFlashError] = useState<string>("");

  useEffect(() => {
    const err = params.get("error");
    if (err) setFlashError(err);
  }, [params]);

  const isBusy = phase.kind === "sending-email" || phase.kind === "verifying";
  const emailLocked =
    phase.kind === "awaiting-code" || phase.kind === "verifying";

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFlashError("");
    const trimmed = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setPhase({ kind: "error", message: "Zadejte platný email." });
      return;
    }
    if (!isSupabaseConfigured()) {
      setPhase({
        kind: "error",
        message: "Supabase není nakonfigurovaný (chybí env proměnné).",
      });
      return;
    }
    setPhase({ kind: "sending-email" });
    try {
      const supabase = getSupabase();
      const emailRedirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo },
      });
      if (error) {
        setPhase({ kind: "error", message: error.message });
        return;
      }
      setEmail(trimmed);
      setCode("");
      setPhase({ kind: "awaiting-code" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPhase({ kind: "error", message: `Nepodařilo se odeslat email: ${msg}` });
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFlashError("");
    const token = code.replace(/\s+/g, "").trim();
    if (!/^\d{6}$/.test(token)) {
      setPhase({ kind: "error", message: "Kód musí být 6místné číslo." });
      return;
    }
    if (!isSupabaseConfigured()) {
      setPhase({
        kind: "error",
        message: "Supabase není nakonfigurovaný (chybí env proměnné).",
      });
      return;
    }
    setPhase({ kind: "verifying" });
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });
      if (error) {
        setPhase({ kind: "error", message: `Kód neplatný nebo vypršel: ${error.message}` });
        return;
      }
      router.replace("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPhase({ kind: "error", message: `Ověření selhalo: ${msg}` });
    }
  };

  const useDifferentEmail = () => {
    setPhase({ kind: "idle" });
    setCode("");
  };

  return (
    <>
      {flashError && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-3 mb-4 text-sm text-[var(--color-wrong)]">
          {flashError}
        </div>
      )}

      <form
        onSubmit={emailLocked ? verifyCode : requestCode}
        className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 space-y-3"
      >
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Email
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={emailLocked || isBusy}
            placeholder="vas@email.cz"
            className="mt-1 w-full px-3 py-2.5 rounded-lg text-sm bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-60"
          />
        </label>

        {phase.kind === "awaiting-code" || phase.kind === "verifying" || (phase.kind === "error" && emailLocked) ? (
          <>
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-200">
              Poslali jsme kód na <span className="font-medium">{email}</span>.
              Otevři email a zadej 6místné číslo níže.
            </div>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
              6místný kód z emailu
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                disabled={isBusy}
                placeholder="123456"
                className="mt-1 w-full px-3 py-3 rounded-lg text-center text-2xl font-mono tracking-[0.5em] bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-[var(--color-primary)] disabled:opacity-60"
              />
            </label>

            <button
              type="submit"
              disabled={isBusy || code.length !== 6}
              className="w-full px-4 py-3 rounded-lg text-sm font-semibold bg-[var(--color-primary)] text-white tap-highlight active:opacity-80 transition-opacity disabled:opacity-50"
            >
              {phase.kind === "verifying" ? "Ověřuji…" : "Potvrdit"}
            </button>

            <div className="flex gap-3 text-xs text-center">
              <button
                type="button"
                onClick={useDifferentEmail}
                className="flex-1 text-gray-500 dark:text-gray-400 underline tap-highlight"
              >
                Použít jiný email
              </button>
              <button
                type="button"
                onClick={requestCode}
                disabled={isBusy}
                className="flex-1 text-[var(--color-primary)] dark:text-blue-400 underline tap-highlight disabled:opacity-50"
              >
                Poslat kód znovu
              </button>
            </div>
          </>
        ) : (
          <button
            type="submit"
            disabled={isBusy}
            className="w-full px-4 py-3 rounded-lg text-sm font-semibold bg-[var(--color-primary)] text-white tap-highlight active:opacity-80 transition-opacity disabled:opacity-50"
          >
            {phase.kind === "sending-email" ? "Odesílám…" : "Poslat přihlašovací kód"}
          </button>
        )}

        {phase.kind === "error" && (
          <p className="text-sm text-[var(--color-wrong)]">{phase.message}</p>
        )}
      </form>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 leading-relaxed">
        V emailu je i klikací odkaz — ten funguje na desktopu, ale na iPhonu
        s appkou na ploše (PWA) tě otevře v Safari mimo appku. Zadání kódu
        přímo tady vás přihlásí uvnitř této aplikace.
      </p>
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
        Zadejte email a pošleme vám 6místný kód.
      </p>

      <Suspense fallback={<div className="text-sm text-gray-400">Načítám…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
