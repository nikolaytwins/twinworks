-- Add priority to checklist_goals (low, medium, high)
ALTER TABLE "checklist_goals" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'medium';
