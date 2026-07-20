import { NextResponse } from "next/server";
import { syncAllItems } from "@/lib/sync";

export async function POST() {
  try {
    const counts = await syncAllItems();
    return NextResponse.json({ ok: true, ...counts });
  } catch (err) {
    console.error("sync error", err);
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}
