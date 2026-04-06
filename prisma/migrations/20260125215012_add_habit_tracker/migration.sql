-- CreateTable
CREATE TABLE "daily_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "dayMode" TEXT,
    "stepsDone" BOOLEAN NOT NULL DEFAULT false,
    "proteinDone" BOOLEAN NOT NULL DEFAULT false,
    "sleepDone" BOOLEAN NOT NULL DEFAULT false,
    "workoutType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "slot_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "periodKey" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "slots" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_logs_date_key" ON "daily_logs"("date");

-- CreateIndex
CREATE UNIQUE INDEX "slot_progress_periodKey_metricKey_key" ON "slot_progress"("periodKey", "metricKey");
