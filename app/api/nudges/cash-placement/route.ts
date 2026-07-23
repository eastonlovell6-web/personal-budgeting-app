import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppSettings, updateAppSettings } from "@/lib/settings";
import { cashPlacementNudge } from "@/lib/aggregations";
import type { CashPlacementAccount } from "@/lib/types";

export async function GET() {
  const settings = await getAppSettings();
  const snoozed =
    settings.nudgeSnoozedUntil != null && settings.nudgeSnoozedUntil > new Date();

  if (snoozed) {
    return NextResponse.json({
      referenceApy: settings.referenceApy,
      snoozedUntil: settings.nudgeSnoozedUntil,
      needsRate: [],
      opportunities: [],
    });
  }

  const rows = await prisma.account.findMany({ where: { type: "depository" } });
  const accounts: CashPlacementAccount[] = rows.map((r) => ({
    accountId: r.accountId,
    name: r.name,
    currentBalance: r.currentBalance,
    apy: r.apy,
  }));

  const result = cashPlacementNudge(accounts, settings.referenceApy);

  return NextResponse.json({
    referenceApy: settings.referenceApy,
    snoozedUntil: settings.nudgeSnoozedUntil,
    ...result,
  });
}

export async function PATCH(req: Request) {
  const body = await req.json();

  if (body.referenceApy !== undefined) {
    if (typeof body.referenceApy !== "number" || body.referenceApy < 0 || body.referenceApy > 20) {
      return NextResponse.json({ error: "referenceApy must be between 0 and 20" }, { status: 400 });
    }
    await updateAppSettings({ referenceApy: body.referenceApy });
  }

  if (body.snooze === true) {
    const nudgeSnoozedUntil = new Date();
    nudgeSnoozedUntil.setDate(nudgeSnoozedUntil.getDate() + 30);
    await updateAppSettings({ nudgeSnoozedUntil });
  }

  return NextResponse.json({ ok: true });
}
