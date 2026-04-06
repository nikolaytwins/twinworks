/*
  Warnings:

  - You are about to drop the `daily_nutrition` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nutrition_food_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `nutrition_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "calls" ADD COLUMN "endTime" DATETIME;

-- AlterTable
ALTER TABLE "personal_settings" ADD COLUMN "lastConfirmedTotalAccounts" REAL;
ALTER TABLE "personal_settings" ADD COLUMN "lastConfirmedTotalAccountsDate" DATETIME;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "daily_nutrition";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "nutrition_food_logs";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "nutrition_settings";
PRAGMA foreign_keys=on;
