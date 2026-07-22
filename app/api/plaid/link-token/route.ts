import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";

export async function POST() {
  try {
    const client = plaidClient();
    const redirectUri = process.env.PLAID_REDIRECT_URI;
    const res = await client.linkTokenCreate({
      user: { client_user_id: "me" },
      client_name: "Budget",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
    });
    return NextResponse.json({ link_token: res.data.link_token });
  } catch (err) {
    console.error("link-token error", err);
    return NextResponse.json(
      { error: "Failed to create link token. Check Plaid keys." },
      { status: 500 }
    );
  }
}
