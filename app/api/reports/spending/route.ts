import { NextResponse } from "next/server";
import { parseRange, loadTxns } from "@/lib/reports";
import { spendingByCategory } from "@/lib/aggregations";
import type { SpendingReport } from "@/lib/types";

export async function GET(req: Request) {
  const { start, end } = parseRange(req.url);
  const txns = await loadTxns(start, end);
  const categories = spendingByCategory(txns);
  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  const report: SpendingReport = { total, categories };
  return NextResponse.json(report);
}
