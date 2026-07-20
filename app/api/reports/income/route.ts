import { NextResponse } from "next/server";
import { parseRange, loadTxns } from "@/lib/reports";
import { incomeReport } from "@/lib/aggregations";

export async function GET(req: Request) {
  const { start, end } = parseRange(req.url);
  const txns = await loadTxns(start, end);
  return NextResponse.json(incomeReport(txns));
}
