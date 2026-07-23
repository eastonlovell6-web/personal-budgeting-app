import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  const body = await req.json();

  if (typeof body.apy !== "number" || body.apy < 0 || body.apy > 20) {
    return NextResponse.json(
      { error: "apy must be a number between 0 and 20" },
      { status: 400 }
    );
  }

  const account = await prisma.account.findUnique({ where: { accountId } });
  if (!account) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.account.update({ where: { accountId }, data: { apy: body.apy } });
  return NextResponse.json({ ok: true });
}
