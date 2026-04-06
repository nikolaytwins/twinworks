-- CreateTable
CREATE TABLE IF NOT EXISTS "lead_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "leadId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL, -- 'created', 'status_changed', 'source_changed', 'date_changed'
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "oldSource" TEXT,
    "newSource" TEXT,
    "oldDate" TEXT,
    "newDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_lead_history_leadId" ON "lead_history"("leadId");
CREATE INDEX IF NOT EXISTS "idx_lead_history_eventType" ON "lead_history"("eventType");
CREATE INDEX IF NOT EXISTS "idx_lead_history_createdAt" ON "lead_history"("createdAt");
