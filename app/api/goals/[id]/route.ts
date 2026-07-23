import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.goal.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: { name?: string; targetAmount?: number; currentAmount?: number } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "") {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (body.targetAmount !== undefined) {
    if (typeof body.targetAmount !== "number" || body.targetAmount <= 0) {
      return NextResponse.json(
        { error: "targetAmount must be a number greater than 0" },
        { status: 400 }
      );
    }
    data.targetAmount = body.targetAmount;
  }
  if (body.currentAmount !== undefined) {
    if (typeof body.currentAmount !== "number" || body.currentAmount < 0) {
      return NextResponse.json(
        { error: "currentAmount must be a number greater than or equal to 0" },
        { status: 400 }
      );
    }
    data.currentAmount = body.currentAmount;
  }

  const goal = await prisma.goal.update({ where: { id }, data });
  return NextResponse.json(goal);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.goal.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.goal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
