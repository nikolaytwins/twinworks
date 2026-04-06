/*
  Warnings:

  - You are about to drop the `lead_history` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "PersonalAccount" ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "checklist_goals" ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "daily_tasks" ADD COLUMN "description" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "lead_history";
PRAGMA foreign_keys=on;
