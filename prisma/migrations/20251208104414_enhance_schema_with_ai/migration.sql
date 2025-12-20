/*
  Warnings:

  - Added the required column `updatedAt` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Candidate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Note` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Offer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Application - Add updatedAt with default, then set to NOT NULL
ALTER TABLE "Application" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
UPDATE "Application" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
ALTER TABLE "Application" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Application" ADD COLUMN "coverLetter" TEXT,
ADD COLUMN "matchScore" DOUBLE PRECISION,
ADD COLUMN "movedAt" TIMESTAMP(3),
ADD COLUMN "source" TEXT;

-- AlterTable: Candidate - Add updatedAt with default, then set to NOT NULL
ALTER TABLE "Candidate" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
UPDATE "Candidate" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
ALTER TABLE "Candidate" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Candidate" ADD COLUMN "currentCompany" TEXT,
ADD COLUMN "currentRole" TEXT,
ADD COLUMN "education" JSONB,
ADD COLUMN "embeddingJson" JSONB,
ADD COLUMN "experience" JSONB,
ADD COLUMN "githubUrl" TEXT,
ADD COLUMN "linkedinUrl" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "portfolioUrl" TEXT,
ADD COLUMN "resumeParseConfidence" DOUBLE PRECISION,
ADD COLUMN "resumeParsedAt" TIMESTAMP(3),
ADD COLUMN "resumeText" TEXT,
ADD COLUMN "skillsParsed" JSONB,
ADD COLUMN "yearsExperience" INTEGER;

-- AlterTable: Event - Add title and updatedAt with defaults, then set to NOT NULL
ALTER TABLE "Event" ADD COLUMN "title" TEXT DEFAULT 'Event';
UPDATE "Event" SET "title" = COALESCE("type", 'Event') WHERE "title" = 'Event';
ALTER TABLE "Event" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "Event" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
UPDATE "Event" SET "updatedAt" = COALESCE("start", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
ALTER TABLE "Event" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Event" ADD COLUMN "attendees" JSONB,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "description" TEXT,
ADD COLUMN "googleEventId" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "microsoftEventId" TEXT,
ADD COLUMN "organizerId" TEXT,
ADD COLUMN "reminderSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "timezone" TEXT DEFAULT 'UTC';

-- AlterTable: Job - Add updatedAt with default, then set to NOT NULL
ALTER TABLE "Job" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
UPDATE "Job" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
ALTER TABLE "Job" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Job" ADD COLUMN "benefits" JSONB,
ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "currency" TEXT DEFAULT 'USD',
ADD COLUMN "department" TEXT,
ADD COLUMN "embeddingJson" JSONB,
ADD COLUMN "employmentType" TEXT,
ADD COLUMN "experienceLevel" TEXT,
ADD COLUMN "location" TEXT,
ADD COLUMN "requirements" JSONB,
ADD COLUMN "salaryMax" INTEGER,
ADD COLUMN "salaryMin" INTEGER;

-- AlterTable: Note - Add updatedAt with default, then set to NOT NULL
ALTER TABLE "Note" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
UPDATE "Note" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
ALTER TABLE "Note" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Note" ADD COLUMN "authorId" TEXT,
ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "tags" JSONB;

-- AlterTable: Offer - Add updatedAt with default, then set to NOT NULL
ALTER TABLE "Offer" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
UPDATE "Offer" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
ALTER TABLE "Offer" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Offer" ADD COLUMN "benefits" JSONB,
ADD COLUMN "currency" TEXT DEFAULT 'USD',
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "previousVersionId" TEXT,
ADD COLUMN "salary" INTEGER,
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "signedAt" TIMESTAMP(3),
ADD COLUMN "signedBy" TEXT,
ADD COLUMN "signedPdfUrl" TEXT,
ADD COLUMN "startDate" TIMESTAMP(3),
ADD COLUMN "templateId" TEXT,
ADD COLUMN "terms" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable: User - Add updatedAt with default, then set to NOT NULL
ALTER TABLE "User" ADD COLUMN "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
UPDATE "User" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
ALTER TABLE "User" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "phone" TEXT;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "applicationId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCandidateMatch" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "skillsScore" DOUBLE PRECISION,
    "experienceScore" DOUBLE PRECISION,
    "educationScore" DOUBLE PRECISION,
    "matchReasons" JSONB,
    "gaps" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobCandidateMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contextType" TEXT,
    "contextId" TEXT,
    "model" TEXT,
    "tokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_applicationId_idx" ON "ActivityLog"("applicationId");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "JobCandidateMatch_jobId_idx" ON "JobCandidateMatch"("jobId");

-- CreateIndex
CREATE INDEX "JobCandidateMatch_candidateId_idx" ON "JobCandidateMatch"("candidateId");

-- CreateIndex
CREATE INDEX "JobCandidateMatch_overallScore_idx" ON "JobCandidateMatch"("overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "JobCandidateMatch_jobId_candidateId_key" ON "JobCandidateMatch"("jobId", "candidateId");

-- CreateIndex
CREATE INDEX "OfferTemplate_isDefault_idx" ON "OfferTemplate"("isDefault");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_idx" ON "ChatMessage"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_contextType_contextId_idx" ON "ChatMessage"("contextType", "contextId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Attachment_createdAt_idx" ON "Attachment"("createdAt");

-- CreateIndex
CREATE INDEX "Application_matchScore_idx" ON "Application"("matchScore");

-- CreateIndex
CREATE INDEX "Candidate_phone_idx" ON "Candidate"("phone");

-- CreateIndex
CREATE INDEX "Candidate_currentCompany_idx" ON "Candidate"("currentCompany");

-- CreateIndex
CREATE INDEX "Event_applicationId_idx" ON "Event"("applicationId");

-- CreateIndex
CREATE INDEX "Event_start_idx" ON "Event"("start");

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "Job_createdById_idx" ON "Job"("createdById");

-- CreateIndex
CREATE INDEX "Job_department_idx" ON "Job"("department");

-- CreateIndex
CREATE INDEX "Job_location_idx" ON "Job"("location");

-- CreateIndex
CREATE INDEX "Note_candidateId_idx" ON "Note"("candidateId");

-- CreateIndex
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt");

-- CreateIndex
CREATE INDEX "Offer_applicationId_idx" ON "Offer"("applicationId");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE INDEX "Offer_sentAt_idx" ON "Offer"("sentAt");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCandidateMatch" ADD CONSTRAINT "JobCandidateMatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobCandidateMatch" ADD CONSTRAINT "JobCandidateMatch_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
