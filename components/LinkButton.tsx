"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

type Status = "idle" | "loading" | "syncing" | "error";

/**
 * Drives the Plaid Link flow: fetch a link token, open Link, exchange the
 * public token (which also runs the first sync), then notify the caller.
 */
function usePlaidConnect(onDone: () => void) {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const start = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.link_token) {
        setStatus("error");
        return;
      }
      // Persisted so the OAuth-return page can resume Link with the same
      // token after a full-page redirect to the bank and back.
      localStorage.setItem("plaid_link_token", json.link_token);
      setToken(json.link_token);
    } catch {
      setStatus("error");
    }
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string) => {
      setStatus("syncing");
      try {
        await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
      } finally {
        localStorage.removeItem("plaid_link_token");
        setStatus("idle");
        setToken(null);
        onDone();
      }
    },
    [onDone]
  );

  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (public_token) => onSuccess(public_token),
    onExit: () => {
      localStorage.removeItem("plaid_link_token");
      setStatus("idle");
      setToken(null);
    },
  });

  // Open Link as soon as we have a token and Plaid is ready.
  useEffect(() => {
    if (token && ready) open();
  }, [token, ready, open]);

  return { start, status };
}

export function ConnectEmptyState({ onLinked }: { onLinked: () => void }) {
  const { start, status } = usePlaidConnect(onLinked);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="text-4xl">🏦</div>
      <div>
        <p className="font-medium">No accounts yet</p>
        <p className="mt-1 text-sm text-muted">
          Connect a bank to see your money.
        </p>
      </div>
      <button
        onClick={start}
        disabled={status === "loading" || status === "syncing"}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {status === "loading"
          ? "Opening…"
          : status === "syncing"
            ? "Syncing…"
            : "Connect a bank"}
      </button>
      {status === "error" && (
        <p className="max-w-xs text-xs text-negative">
          Couldn’t start Plaid. Check that your Plaid keys are set in the
          server environment.
        </p>
      )}
    </div>
  );
}

export function AddAccountButton({ onLinked }: { onLinked: () => void }) {
  const { start, status } = usePlaidConnect(onLinked);
  return (
    <button
      onClick={start}
      disabled={status === "loading" || status === "syncing"}
      className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted disabled:opacity-50"
      aria-label="Add account"
    >
      {status === "syncing" ? "Syncing…" : "＋ Account"}
    </button>
  );
}

/**
 * Rendered at "/" when Plaid's OAuth redirect lands back with an
 * oauth_state_id query param. Resumes Link with the token saved by
 * usePlaidConnect before the redirect out to the bank, then clears the query
 * string. Plaid's dashboard only allows a bare-origin redirect_uri for this
 * account, so this can't live on its own route — it must run at "/".
 */
export function PlaidOAuthResume() {
  const router = useRouter();
  const [token] = useState<string | null | undefined>(() =>
    typeof window === "undefined"
      ? undefined
      : localStorage.getItem("plaid_link_token")
  );

  const { open, ready } = usePlaidLink({
    token: token ?? null,
    receivedRedirectUri:
      typeof window !== "undefined" ? window.location.href : undefined,
    onSuccess: async (public_token) => {
      localStorage.removeItem("plaid_link_token");
      try {
        await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ public_token }),
        });
      } finally {
        router.replace("/");
      }
    },
    onExit: () => {
      localStorage.removeItem("plaid_link_token");
      router.replace("/");
    },
  });

  useEffect(() => {
    if (token && ready) open();
  }, [token, ready, open]);

  useEffect(() => {
    // No token in localStorage means this wasn't a real OAuth redirect
    // (e.g. the query param was hit directly) — nothing to resume.
    if (token === null) router.replace("/");
  }, [token, router]);

  return (
    <main className="flex flex-1 items-center justify-center py-20 text-sm text-muted">
      Finishing bank connection…
    </main>
  );
}
