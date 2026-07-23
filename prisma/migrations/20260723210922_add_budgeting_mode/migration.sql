-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "budgetingMode" TEXT NOT NULL DEFAULT 'automated';

-- CreateTable
CREATE TABLE "CategoryCap" (
    "group" TEXT NOT NULL,
    "monthlyCap" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CategoryCap_pkey" PRIMARY KEY ("group")
);
