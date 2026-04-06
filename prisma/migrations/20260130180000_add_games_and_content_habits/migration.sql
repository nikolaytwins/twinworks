-- AlterTable
ALTER TABLE "daily_logs" ADD COLUMN "gamesDone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "daily_logs" ADD COLUMN "contentWritingDone" BOOLEAN NOT NULL DEFAULT false;
