-- Remove CANDIDATE from Role enum
-- First, update any users with CANDIDATE role to RECRUITER (or handle as needed)
UPDATE "User" SET "role" = 'RECRUITER' WHERE "role" = 'CANDIDATE';

-- Drop the default temporarily
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

-- Now alter the enum to remove CANDIDATE
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RECRUITER', 'HIRING_MANAGER');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_old";

-- Restore the default
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'RECRUITER';

