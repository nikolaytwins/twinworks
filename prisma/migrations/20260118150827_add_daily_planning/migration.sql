-- CreateTable
CREATE TABLE "daily_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "isKey" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "duration" INTEGER,
    "participant" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_monthly_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalAccounts" REAL NOT NULL DEFAULT 0,
    "cushionAmount" REAL NOT NULL DEFAULT 0,
    "goalsAmount" REAL NOT NULL DEFAULT 0,
    "personalExpenses" REAL NOT NULL DEFAULT 0,
    "businessExpenses" REAL NOT NULL DEFAULT 0,
    "agencyExpectedRevenue" REAL NOT NULL DEFAULT 0,
    "agencyActualRevenue" REAL NOT NULL DEFAULT 0,
    "agencyExpectedProfit" REAL NOT NULL DEFAULT 0,
    "agencyActualProfit" REAL NOT NULL DEFAULT 0,
    "impulseExpectedRevenue" REAL NOT NULL DEFAULT 0,
    "impulseActualRevenue" REAL NOT NULL DEFAULT 0,
    "impulseExpectedProfit" REAL NOT NULL DEFAULT 0,
    "impulseActualProfit" REAL NOT NULL DEFAULT 0,
    "totalExpectedProfit" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_monthly_history" ("agencyActualProfit", "agencyActualRevenue", "agencyExpectedProfit", "agencyExpectedRevenue", "createdAt", "cushionAmount", "goalsAmount", "id", "impulseActualProfit", "impulseActualRevenue", "impulseExpectedProfit", "impulseExpectedRevenue", "month", "totalAccounts", "totalExpectedProfit", "updatedAt", "year") SELECT "agencyActualProfit", "agencyActualRevenue", "agencyExpectedProfit", "agencyExpectedRevenue", "createdAt", "cushionAmount", "goalsAmount", "id", "impulseActualProfit", "impulseActualRevenue", "impulseExpectedProfit", "impulseExpectedRevenue", "month", "totalAccounts", "totalExpectedProfit", "updatedAt", "year" FROM "monthly_history";
DROP TABLE "monthly_history";
ALTER TABLE "new_monthly_history" RENAME TO "monthly_history";
CREATE UNIQUE INDEX "monthly_history_year_month_key" ON "monthly_history"("year", "month");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
