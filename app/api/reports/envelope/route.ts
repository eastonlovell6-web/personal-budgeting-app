import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseRange, loadTxns } from "@/lib/reports";
import { envelopeProgress } from "@/lib/aggregations";
import { monthsInRange } from "@/lib/format";
import type { EnvelopeReport } from "@/lib/types";

export async function GET(req: Request) {
  const { start, end } = parseRange(req.url);
  const txns = await loadTxns(start, end);

  const capRows = await prisma.categoryCap.findMany();
  const caps: Record<string, number> = {};
  for (const c of capRows) caps[c.group] = c.monthlyCap;

  const months = monthsInRange(start, end);
  const groups = envelopeProgress(txns, caps, months);

  const report: EnvelopeReport = { groups, months };
  return NextResponse.json(report);
}
