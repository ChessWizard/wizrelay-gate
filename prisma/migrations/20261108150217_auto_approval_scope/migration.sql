/*
  Warnings:

  - Made the column `relayId` on table `AutoApproval` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "AutoApproval" ALTER COLUMN "relayId" SET NOT NULL,
ALTER COLUMN "relayId" SET DEFAULT '';
