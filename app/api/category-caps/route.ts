import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { GROUPS } from "@/lib/categories";

const EXPENSE_GROUPS: readonly string[] = GROUPS.filter((g) => g !== "Income");

function validateCap(body: {
  group?: unknown;
  monthlyCap?: unknown;
}): string | null {
  if (typeof body.group !== "string" || !EXPENSE_GROUPS.includes(body.group)) {
    return `group must be one of: ${EXPENSE_GROUPS.join(", ")}`;
  }
  if (typeof body.monthlyCap !== "number" || body.monthlyCap <= 0) {
    return "monthlyCap must be a number greater than 0";
  }
  return null;
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const error = validateCap(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const cap = await prisma.categoryCap.upsert({
    where: { group: body.group },
    create: { group: body.group, monthlyCap: body.monthlyCap },
    update: { monthlyCap: body.monthlyCap },
  });
  return NextResponse.json(cap);
}
