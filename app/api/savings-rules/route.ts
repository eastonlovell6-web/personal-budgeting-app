import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function validateNewRule(body: {
  type?: unknown;
  percent?: unknown;
  increment?: unknown;
}): string | null {
  if (body.type !== "split" && body.type !== "roundup") {
    return 'type must be "split" or "roundup"';
  }
  if (body.type === "split") {
    if (typeof body.percent !== "number" || body.percent < 0 || body.percent > 100) {
      return "percent must be a number between 0 and 100";
    }
  }
  if (body.type === "roundup") {
    if (body.increment !== 1 && body.increment !== 5) {
      return "increment must be 1 or 5";
    }
  }
  return null;
}

export async function GET() {
  const rules = await prisma.savingsRule.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rules);
}

export async function POST(req: Request) {
  const body = await req.json();
  const error = validateNewRule(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const rule = await prisma.savingsRule.create({
    data: {
      type: body.type,
      percent: body.type === "split" ? body.percent : null,
      increment: body.type === "roundup" ? body.increment : null,
    },
  });
  return NextResponse.json(rule);
}
