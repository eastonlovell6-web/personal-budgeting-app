import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { investingSummary } from "@/lib/aggregations";
import type { InvestmentAccount, InvestingReport } from "@/lib/types";

export async function GET() {
  const rows = await prisma.account.findMany({
    where: { type: "investment" },
    include: { item: true },
  });
  const accounts: InvestmentAccount[] = rows.map((r) => ({
    accountId: r.accountId,
    name: r.name,
    institution: r.item.institution,
    currentBalance: r.currentBalance,
  }));
  const report: InvestingReport = investingSummary(accounts);
  return NextResponse.json(report);
}
