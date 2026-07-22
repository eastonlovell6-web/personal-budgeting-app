import { NextResponse } from "next/server";
import { parseRange, loadTxns, loadInvestmentTransferTotal } from "@/lib/reports";
import { cashflowSankey, cashflowStats } from "@/lib/aggregations";
import type { CashflowReport } from "@/lib/types";

export async function GET(req: Request) {
  const { start, end } = parseRange(req.url);
  const [txns, investingTotal] = await Promise.all([
    loadTxns(start, end),
    loadInvestmentTransferTotal(start, end),
  ]);
  const report: CashflowReport = {
    sankey: cashflowSankey(txns, investingTotal),
    stats: cashflowStats(txns, investingTotal),
  };
  return NextResponse.json(report);
}
