/*
  Warnings:

  - You are about to drop the column `faviconData` on the `Panel` table. All the data in the column will be lost.
  - You are about to drop the column `faviconMime` on the `Panel` table. All the data in the column will be lost.
  - You are about to drop the column `logoData` on the `Panel` table. All the data in the column will be lost.
  - You are about to drop the column `logoMime` on the `Panel` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Panel" DROP COLUMN "faviconData",
DROP COLUMN "faviconMime",
DROP COLUMN "logoData",
DROP COLUMN "logoMime",
ADD COLUMN     "faviconFile" TEXT,
ADD COLUMN     "logoFile" TEXT;
