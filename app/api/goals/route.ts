import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function validateNewGoal(body: {
  name?: unknown;
  targetAmount?: unknown;
}): string | null {
  if (typeof body.name !== "string" || body.name.trim() === "") {
    return "name must be a non-empty string";
  }
  if (typeof body.targetAmount !== "number" || body.targetAmount <= 0) {
    return "targetAmount must be a number greater than 0";
  }
  return null;
}

export async function GET() {
  const goals = await prisma.goal.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const body = await req.json();
  const error = validateNewGoal(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const goal = await prisma.goal.create({
    data: {
      name: body.name.trim(),
      targetAmount: body.targetAmount,
    },
  });
  return NextResponse.json(goal);
}
