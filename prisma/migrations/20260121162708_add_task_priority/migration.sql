-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_daily_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "isKey" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'movable',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_daily_tasks" ("completed", "createdAt", "date", "id", "isKey", "order", "title", "updatedAt") SELECT "completed", "createdAt", "date", "id", "isKey", "order", "title", "updatedAt" FROM "daily_tasks";
DROP TABLE "daily_tasks";
ALTER TABLE "new_daily_tasks" RENAME TO "daily_tasks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
