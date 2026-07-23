-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "apy" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "referenceApy" DOUBLE PRECISION,
    "nudgeSnoozedUntil" TIMESTAMP(3),

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
