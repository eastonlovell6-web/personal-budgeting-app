-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "cursor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "accountId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currentBalance" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "merchantName" TEXT,
    "name" TEXT NOT NULL,
    "pfPrimary" TEXT NOT NULL,
    "pfDetailed" TEXT NOT NULL,
    "isIncome" BOOLEAN NOT NULL,
    "pending" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("transactionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_itemId_key" ON "Item"("itemId");

-- CreateIndex
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("accountId") ON DELETE CASCADE ON UPDATE CASCADE;
