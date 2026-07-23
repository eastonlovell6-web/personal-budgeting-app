-- CreateTable
CREATE TABLE "SavingsRule" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "percent" DOUBLE PRECISION,
    "increment" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsRule_pkey" PRIMARY KEY ("id")
);
