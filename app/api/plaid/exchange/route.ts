import { NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { syncItem, institutionName } from "@/lib/sync";

export async function POST(req: Request) {
  try {
    const { public_token } = (await req.json()) as { public_token?: string };
    if (!public_token) {
      return NextResponse.json({ error: "missing public_token" }, { status: 400 });
    }

    const client = plaidClient();
    const ex = await client.itemPublicTokenExchange({ public_token });
    const accessToken = ex.data.access_token;
    const itemId = ex.data.item_id;
    const institution = await institutionName(accessToken);

    await prisma.item.upsert({
      where: { itemId },
      create: { itemId, accessToken: encrypt(accessToken), institution },
      update: { accessToken: encrypt(accessToken), institution },
    });

    const counts = await syncItem(itemId);
    return NextResponse.json({ ok: true, institution, counts });
  } catch (err) {
    console.error("exchange error", err);
    return NextResponse.json({ error: "Failed to link account." }, { status: 500 });
  }
}
