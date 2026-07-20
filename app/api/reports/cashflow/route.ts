import { NextResponse } from "next/server";
import { parseRange, loadTxns } from "@/lib/reports";
import { cashflowSankey, cashflowStats } from "@/lib/aggregations";
import type { CashflowReport } from "@/lib/types";

export async function GET(req: Request) {
  const { start, end } = parseRange(req.url);
  const txns = await loadTxns(start, end);
  const report: CashflowReport = {
    sankey: cashflowSankey(txns),
    stats: cashflowStats(txns),
  };
  return NextResponse.json(report);
}
