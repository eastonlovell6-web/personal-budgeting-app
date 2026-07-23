import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseRange, loadTxns } from "@/lib/reports";
import { savingsRulesSimulation } from "@/lib/aggregations";
import type { SavingsReport, SavingsRule } from "@/lib/types";

export async function GET(req: Request) {
  const { start, end } = parseRange(req.url);
  const [txns, ruleRows] = await Promise.all([
    loadTxns(start, end),
    prisma.savingsRule.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const rules: SavingsRule[] = ruleRows.map((r) => ({
    id: r.id,
    type: r.type as SavingsRule["type"],
    active: r.active,
    percent: r.percent,
    increment: r.increment,
  }));
  const result = savingsRulesSimulation(txns, rules);
  const report: SavingsReport = { rules, ...result };
  return NextResponse.json(report);
}
