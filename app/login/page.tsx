"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setLoading(false);
    if (res.ok) {
      router.replace("/");
      router.refresh();
    } else {
      setError(true);
      setPasscode("");
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 safe-top safe-bottom">
      <div className="w-full max-w-xs text-center">
        <div className="mb-8 text-3xl">🦋</div>
        <h1 className="mb-1 text-xl font-semibold">Budget</h1>
        <p className="mb-8 text-sm text-muted">Enter your passcode</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-lg tracking-widest text-foreground outline-none focus:border-accent"
            placeholder="••••••"
          />
          {error && (
            <p className="text-sm text-negative">Incorrect passcode</p>
          )}
          <button
            type="submit"
            disabled={loading || passcode.length === 0}
            className="rounded-xl bg-accent px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {loading ? "…" : "Unlock"}
          </button>
        </form>
      </div>
    </main>
  );
}
