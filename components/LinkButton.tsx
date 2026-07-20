"use client";

// NOTE: real Plaid Link wiring lands in Task 12. This stub renders the
// empty-state prompt and a placeholder action.

export function ConnectEmptyState({ onLinked }: { onLinked: () => void }) {
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
        onClick={onLinked}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white"
      >
        Connect a bank
      </button>
    </div>
  );
}
