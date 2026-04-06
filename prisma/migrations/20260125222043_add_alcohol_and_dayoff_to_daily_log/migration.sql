-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_daily_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "dayMode" TEXT,
    "stepsDone" BOOLEAN NOT NULL DEFAULT false,
    "proteinDone" BOOLEAN NOT NULL DEFAULT false,
    "sleepDone" BOOLEAN NOT NULL DEFAULT false,
    "workoutType" TEXT,
    "alcohol" BOOLEAN NOT NULL DEFAULT false,
    "dayOff" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_daily_logs" ("createdAt", "date", "dayMode", "id", "proteinDone", "sleepDone", "stepsDone", "updatedAt", "workoutType") SELECT "createdAt", "date", "dayMode", "id", "proteinDone", "sleepDone", "stepsDone", "updatedAt", "workoutType" FROM "daily_logs";
DROP TABLE "daily_logs";
ALTER TABLE "new_daily_logs" RENAME TO "daily_logs";
CREATE UNIQUE INDEX "daily_logs_date_key" ON "daily_logs"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
