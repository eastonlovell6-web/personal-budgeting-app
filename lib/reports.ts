// Shared helpers for the report API routes: date-range parsing + txn loading.
import { prisma } from "@/lib/db";
import type { Txn } from "@/lib/types";

/** Parse ?start & ?end (YYYY-MM-DD); default to the last 6 whole months. */
export function parseRange(url: string): { start: Date; end: Date } {
  const { searchParams } = new URL(url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  const end = endParam ? new Date(endParam + "T23:59:59.999Z") : endOfToday();
  const start = startParam
    ? new Date(startParam + "T00:00:00.000Z")
    : sixMonthsBefore(end);
  return { start, end };
}

function endOfToday(): Date {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)
  );
}

function sixMonthsBefore(end: Date): Date {
  return new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 5, 1, 0, 0, 0, 0)
  );
}

/** Load transactions in [start, end] as the lightweight Txn shape.
 * Internal transfers are excluded — they're neither income nor spending. */
export async function loadTxns(start: Date, end: Date): Promise<Txn[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      date: { gte: start, lte: end },
      NOT: { pfPrimary: { startsWith: "TRANSFER" } },
    },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    transactionId: r.transactionId,
    date: r.date,
    amount: r.amount,
    merchantName: r.merchantName,
    name: r.name,
    pfPrimary: r.pfPrimary,
    pfDetailed: r.pfDetailed,
    isIncome: r.isIncome,
  }));
}
