// Pulls transactions from Plaid into the local DB via /transactions/sync.
import { CountryCode } from "plaid";
import type { Transaction as PlaidTxn } from "plaid";
import { prisma } from "@/lib/db";
import { plaidClient } from "@/lib/plaid";
import { decrypt } from "@/lib/crypto";
import { isIncomeCategory } from "@/lib/categories";

export type SyncCounts = { added: number; modified: number; removed: number };

function mapTxn(t: PlaidTxn) {
  const primary = t.personal_finance_category?.primary ?? "GENERAL_MERCHANDISE";
  const detailed =
    t.personal_finance_category?.detailed ??
    "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE";
  return {
    transactionId: t.transaction_id,
    accountId: t.account_id,
    date: new Date(t.date),
    amount: Math.abs(t.amount), // store positive magnitude
    merchantName: t.merchant_name ?? null,
    name: t.name,
    pfPrimary: primary,
    pfDetailed: detailed,
    isIncome: isIncomeCategory(primary),
    pending: t.pending,
  };
}

/** Sync a single item (bank connection) into the DB. */
export async function syncItem(itemId: string): Promise<SyncCounts> {
  const item = await prisma.item.findUnique({ where: { itemId } });
  if (!item) throw new Error(`unknown item ${itemId}`);

  const client = plaidClient();
  const accessToken = decrypt(item.accessToken);

  // 1) Upsert accounts first so transaction FKs resolve.
  const accountsRes = await client.accountsGet({ access_token: accessToken });
  for (const a of accountsRes.data.accounts) {
    await prisma.account.upsert({
      where: { accountId: a.account_id },
      create: {
        accountId: a.account_id,
        itemId: item.id,
        name: a.name,
        type: String(a.type),
        currentBalance: a.balances.current ?? null,
      },
      update: {
        name: a.name,
        type: String(a.type),
        currentBalance: a.balances.current ?? null,
        updatedAt: new Date(),
      },
    });
  }

  // 2) Page through transactionsSync.
  const added: PlaidTxn[] = [];
  const modified: PlaidTxn[] = [];
  const removed: string[] = [];
  let cursor = item.cursor ?? undefined;
  let hasMore = true;
  while (hasMore) {
    const res = await client.transactionsSync({
      access_token: accessToken,
      cursor,
    });
    added.push(...res.data.added);
    modified.push(...res.data.modified);
    removed.push(...res.data.removed.map((r) => r.transaction_id));
    cursor = res.data.next_cursor;
    hasMore = res.data.has_more;
  }

  // 3) Persist changes.
  for (const t of [...added, ...modified]) {
    const row = mapTxn(t);
    await prisma.transaction.upsert({
      where: { transactionId: row.transactionId },
      create: row,
      update: row,
    });
  }
  if (removed.length) {
    await prisma.transaction.deleteMany({
      where: { transactionId: { in: removed } },
    });
  }

  // 4) Save cursor for next incremental sync.
  await prisma.item.update({ where: { itemId }, data: { cursor } });

  return {
    added: added.length,
    modified: modified.length,
    removed: removed.length,
  };
}

/** Sync every connected item; totals the counts. */
export async function syncAllItems(): Promise<SyncCounts> {
  const items = await prisma.item.findMany();
  const total: SyncCounts = { added: 0, modified: 0, removed: 0 };
  for (const item of items) {
    const c = await syncItem(item.itemId);
    total.added += c.added;
    total.modified += c.modified;
    total.removed += c.removed;
  }
  return total;
}

/** Resolve an institution's display name from an item's institution_id. */
export async function institutionName(accessToken: string): Promise<string> {
  const client = plaidClient();
  try {
    const itemRes = await client.itemGet({ access_token: accessToken });
    const instId = itemRes.data.item.institution_id;
    if (!instId) return "Bank";
    const inst = await client.institutionsGetById({
      institution_id: instId,
      country_codes: [CountryCode.Us],
    });
    return inst.data.institution.name;
  } catch {
    return "Bank";
  }
}
