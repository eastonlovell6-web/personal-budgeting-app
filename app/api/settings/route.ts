import { NextResponse } from "next/server";
import { getAppSettings, updateAppSettings } from "@/lib/settings";

export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json({ budgetingMode: settings.budgetingMode });
}

export async function PATCH(req: Request) {
  const body = await req.json();

  if (body.budgetingMode !== "automated" && body.budgetingMode !== "envelope") {
    return NextResponse.json(
      { error: 'budgetingMode must be "automated" or "envelope"' },
      { status: 400 }
    );
  }

  await updateAppSettings({ budgetingMode: body.budgetingMode });
  return NextResponse.json({ ok: true });
}
