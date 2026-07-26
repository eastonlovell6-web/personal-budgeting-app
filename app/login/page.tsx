"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Focus imperatively post-mount (not via the `autoFocus` attribute) so the
  // keyboard can't pop — and catch keystrokes — before React has hydrated
  // and attached the onChange handler. On a slow mobile load, a statically
  // autofocused input opens the keyboard while still server-rendered HTML;
  // any digits typed in that window land in the raw DOM, not React state,
  // and get silently wiped once hydration reconciles the controlled value
  // back to "" — leaving passcode.length === 0 and the button stuck disabled.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
    } catch {
      // network error — fall through to the error state below
    }
    setLoading(false);
    setError(true);
    setPasscode("");
  }

  return (
    <main className="flex flex-1 flex-col items-center overflow-y-auto px-6 pt-24 safe-top safe-bottom">
      <div className="w-full max-w-xs text-center">
        <div className="mb-8 text-3xl">🦋</div>
        <h1 className="mb-1 text-xl font-semibold">Budget</h1>
        <p className="mb-8 text-sm text-muted">Enter your passcode</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-4 py-3 text-center text-lg tracking-widest text-foreground outline-none focus:border-accent"
            placeholder="••••••"
          />
          {error && (
            <p className="text-sm text-negative">Incorrect passcode</p>
          )}
          <button
            type="submit"
            disabled={loading || passcode.length === 0}
            className="rounded-pill bg-accent px-4 py-3 font-medium text-ink disabled:opacity-40"
          >
            {loading ? "…" : "Unlock"}
          </button>
        </form>
      </div>
    </main>
  );
}
