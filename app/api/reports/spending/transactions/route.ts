import { NextResponse } from "next/server";
import { parseRange, loadTxns } from "@/lib/reports";
import { transactionsForCategory } from "@/lib/aggregations";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }
  const { start, end } = parseRange(req.url);
  const txns = await loadTxns(start, end);
  const transactions = transactionsForCategory(txns, category);
  return NextResponse.json(transactions);
}
