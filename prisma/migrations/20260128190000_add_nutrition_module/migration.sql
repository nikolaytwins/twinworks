-- Nutrition module tables

-- food logs per message
CREATE TABLE "nutrition_food_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateKey" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "parsedJson" TEXT,
    "protein" REAL NOT NULL DEFAULT 0,
    "fat" REAL NOT NULL DEFAULT 0,
    "carbs" REAL NOT NULL DEFAULT 0,
    "kcal" REAL NOT NULL DEFAULT 0,
    "confidence" REAL,
    "source" TEXT,
    "telegramUpdateId" TEXT
);

CREATE UNIQUE INDEX "nutrition_food_logs_telegramUpdateId_key"
ON "nutrition_food_logs"("telegramUpdateId");

-- daily aggregates
CREATE TABLE "daily_nutrition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateKey" TEXT NOT NULL,
    "proteinTotal" REAL NOT NULL DEFAULT 0,
    "fatTotal" REAL NOT NULL DEFAULT 0,
    "carbsTotal" REAL NOT NULL DEFAULT 0,
    "kcalTotal" REAL NOT NULL DEFAULT 0,
    "proteinTarget" REAL NOT NULL DEFAULT 140,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "daily_nutrition_dateKey_key"
ON "daily_nutrition"("dateKey");

-- settings (single row)
CREATE TABLE "nutrition_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramChatId" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Brussels',
    "proteinTargetDefault" REAL NOT NULL DEFAULT 140,
    "updatedAt" DATETIME NOT NULL
);

