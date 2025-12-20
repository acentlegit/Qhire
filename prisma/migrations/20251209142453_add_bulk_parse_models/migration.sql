-- CreateEnum
CREATE TYPE "BulkParseStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BulkParseJob" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "createdBy" TEXT NOT NULL,
    "status" "BulkParseStatus" NOT NULL DEFAULT 'PROCESSING',
    "totalFiles" INTEGER NOT NULL,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "errorFiles" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkParseJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkParseResult" (
    "id" TEXT NOT NULL,
    "batchJobId" TEXT NOT NULL,
    "candidateId" TEXT,
    "filename" TEXT NOT NULL,
    "fileUrl" TEXT,
    "status" TEXT NOT NULL,
    "parsedData" JSONB,
    "email" TEXT,
    "matchScore" DOUBLE PRECISION,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkParseResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkParseJob_createdBy_idx" ON "BulkParseJob"("createdBy");

-- CreateIndex
CREATE INDEX "BulkParseJob_status_idx" ON "BulkParseJob"("status");

-- CreateIndex
CREATE INDEX "BulkParseJob_createdAt_idx" ON "BulkParseJob"("createdAt");

-- CreateIndex
CREATE INDEX "BulkParseResult_batchJobId_idx" ON "BulkParseResult"("batchJobId");

-- CreateIndex
CREATE INDEX "BulkParseResult_candidateId_idx" ON "BulkParseResult"("candidateId");

-- CreateIndex
CREATE INDEX "BulkParseResult_status_idx" ON "BulkParseResult"("status");

-- CreateIndex
CREATE INDEX "BulkParseResult_email_idx" ON "BulkParseResult"("email");

-- AddForeignKey
ALTER TABLE "BulkParseResult" ADD CONSTRAINT "BulkParseResult_batchJobId_fkey" FOREIGN KEY ("batchJobId") REFERENCES "BulkParseJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkParseResult" ADD CONSTRAINT "BulkParseResult_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
