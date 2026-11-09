-- CreateTable
CREATE TABLE "AutoApproval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relayId" TEXT,
    "commits" BOOLEAN NOT NULL DEFAULT true,
    "pushes" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoApproval_userId_idx" ON "AutoApproval"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoApproval_userId_relayId_key" ON "AutoApproval"("userId", "relayId");

-- AddForeignKey
ALTER TABLE "AutoApproval" ADD CONSTRAINT "AutoApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
