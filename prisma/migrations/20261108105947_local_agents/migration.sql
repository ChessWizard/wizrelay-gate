-- CreateEnum
CREATE TYPE "AgentJobState" AS ENUM ('QUEUED', 'CLAIMED', 'DONE', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "hostname" TEXT,
    "platform" TEXT,
    "version" TEXT,
    "protocol" INTEGER NOT NULL DEFAULT 1,
    "repos" JSONB,
    "binaries" JSONB,
    "claudeEmail" TEXT,
    "claudeName" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPairing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "state" "AgentJobState" NOT NULL DEFAULT 'QUEUED',
    "kind" TEXT NOT NULL,
    "binary" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "cwd" TEXT,
    "command" TEXT NOT NULL,
    "timeoutMs" INTEGER NOT NULL DEFAULT 300000,
    "relayId" TEXT,
    "gate" TEXT,
    "role" TEXT,
    "exitCode" INTEGER,
    "stdout" TEXT,
    "stderr" TEXT,
    "timedOut" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentJobChunk" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "stream" TEXT NOT NULL,
    "line" TEXT NOT NULL,

    CONSTRAINT "AgentJobChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_tokenHash_key" ON "Agent"("tokenHash");

-- CreateIndex
CREATE INDEX "Agent_userId_idx" ON "Agent"("userId");

-- CreateIndex
CREATE INDEX "Agent_lastSeenAt_idx" ON "Agent"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPairing_codeHash_key" ON "AgentPairing"("codeHash");

-- CreateIndex
CREATE INDEX "AgentPairing_userId_idx" ON "AgentPairing"("userId");

-- CreateIndex
CREATE INDEX "AgentPairing_expiresAt_idx" ON "AgentPairing"("expiresAt");

-- CreateIndex
CREATE INDEX "AgentJob_agentId_state_idx" ON "AgentJob"("agentId", "state");

-- CreateIndex
CREATE INDEX "AgentJob_createdAt_idx" ON "AgentJob"("createdAt");

-- CreateIndex
CREATE INDEX "AgentJobChunk_jobId_idx" ON "AgentJobChunk"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentJobChunk_jobId_seq_key" ON "AgentJobChunk"("jobId", "seq");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPairing" ADD CONSTRAINT "AgentPairing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentJobChunk" ADD CONSTRAINT "AgentJobChunk_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AgentJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
