-- AlterTable
ALTER TABLE "Hub" ADD COLUMN     "fetchedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Panel" ADD COLUMN     "brandVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "faviconData" BYTEA,
ADD COLUMN     "faviconMime" TEXT,
ADD COLUMN     "logoData" BYTEA,
ADD COLUMN     "logoMime" TEXT;
