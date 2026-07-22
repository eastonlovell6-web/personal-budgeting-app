"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";

/**
 * Where Plaid Link redirects back to after an OAuth bank login. Resumes Link
 * with the same token used before the redirect (persisted in localStorage
 * by LinkButton) plus the full return URL, per Plaid's OAuth flow.
 */
export default function PlaidOAuthReturn() {
  const router = useRouter();
  // undefined = not yet on the client (SSR pass), null = checked and
  // missing, string = found. Read lazily in the initializer (not an effect)
  // since localStorage is only available once mounted client-side.
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
    // No token in localStorage means this page was opened directly,
    // not via a real OAuth redirect — nothing to resume.
    if (token === null) router.replace("/");
  }, [token, router]);


  return (
    <main className="flex flex-1 items-center justify-center py-20 text-sm text-muted">
      Finishing bank connection…
    </main>
  );
}
