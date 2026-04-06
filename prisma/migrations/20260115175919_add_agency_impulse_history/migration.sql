-- CreateTable
CREATE TABLE "AgencyProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'not_paid',
    "serviceType" TEXT NOT NULL,
    "clientContact" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AgencyExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeRole" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgencyExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AgencyProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImpulseStudent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'not_paid',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ImpulseExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeRole" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImpulseExpense_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "ImpulseStudent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "monthly_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "totalAccounts" REAL NOT NULL DEFAULT 0,
    "cushionAmount" REAL NOT NULL DEFAULT 0,
    "goalsAmount" REAL NOT NULL DEFAULT 0,
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

-- CreateIndex
CREATE UNIQUE INDEX "monthly_history_year_month_key" ON "monthly_history"("year", "month");
