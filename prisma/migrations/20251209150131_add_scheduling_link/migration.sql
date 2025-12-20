-- CreateTable
CREATE TABLE "SchedulingLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "applicationId" TEXT,
    "jobId" TEXT,
    "candidateId" TEXT,
    "createdById" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "availableSlots" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchedulingLink_token_key" ON "SchedulingLink"("token");

-- CreateIndex
CREATE INDEX "SchedulingLink_token_idx" ON "SchedulingLink"("token");

-- CreateIndex
CREATE INDEX "SchedulingLink_applicationId_idx" ON "SchedulingLink"("applicationId");

-- CreateIndex
CREATE INDEX "SchedulingLink_jobId_idx" ON "SchedulingLink"("jobId");

-- CreateIndex
CREATE INDEX "SchedulingLink_candidateId_idx" ON "SchedulingLink"("candidateId");

-- CreateIndex
CREATE INDEX "SchedulingLink_expiresAt_idx" ON "SchedulingLink"("expiresAt");
