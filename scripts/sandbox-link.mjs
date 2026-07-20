// One-off: create a Plaid sandbox public_token and run it through the app's
// real /api/plaid/exchange endpoint (which stores the item + syncs). Verifies
// the full Plaid pipeline end-to-end without the interactive Link UI.
import { readFileSync } from "node:fs";
import { Configuration, PlaidApi, PlaidEnvironments, Products } from "plaid";

// Minimal .env parse (no dep).
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const client = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV || "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
        "PLAID-SECRET": env.PLAID_SECRET,
      },
    },
  })
);

// 1) Sandbox public token for a test bank with transactions.
const pt = await client.sandboxPublicTokenCreate({
  institution_id: "ins_109508", // First Platypus Bank
  initial_products: [Products.Transactions],
});
const publicToken = pt.data.public_token;
console.log("sandbox public_token created");

// 2) Log into the app to get a session cookie.
const login = await fetch("http://localhost:3000/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ passcode: env.APP_PASSCODE }),
});
const cookie = login.headers.get("set-cookie").split(";")[0];

// 3) Exchange through the app (stores item + runs first sync).
const ex = await fetch("http://localhost:3000/api/plaid/exchange", {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ public_token: publicToken }),
});
console.log("exchange:", ex.status, JSON.stringify(await ex.json()));
