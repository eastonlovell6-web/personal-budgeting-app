import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.savingsRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: { active?: boolean; percent?: number; increment?: number } = {};

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
    }
    data.active = body.active;
  }
  if (body.percent !== undefined) {
    if (typeof body.percent !== "number" || body.percent < 0 || body.percent > 100) {
      return NextResponse.json(
        { error: "percent must be a number between 0 and 100" },
        { status: 400 }
      );
    }
    data.percent = body.percent;
  }
  if (body.increment !== undefined) {
    if (body.increment !== 1 && body.increment !== 5) {
      return NextResponse.json({ error: "increment must be 1 or 5" }, { status: 400 });
    }
    data.increment = body.increment;
  }

  const rule = await prisma.savingsRule.update({ where: { id }, data });
  return NextResponse.json(rule);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.savingsRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.savingsRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
