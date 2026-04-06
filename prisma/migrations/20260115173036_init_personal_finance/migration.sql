-- CreateTable
CREATE TABLE "PersonalAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "balance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PersonalTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "category" TEXT,
    "description" TEXT,
    "fromAccountId" TEXT,
    "toAccountId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PersonalTransaction_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "PersonalAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PersonalTransaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "PersonalAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonalGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" REAL NOT NULL,
    "currentAmount" REAL NOT NULL DEFAULT 0,
    "linkedAccountId" TEXT,
    "deadline" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PersonalGoal_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "PersonalAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "personal_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expectedMonthlyExpenses" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
