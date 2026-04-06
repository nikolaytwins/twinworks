-- Add optional (ideal/not required) to checklist_goals
ALTER TABLE "checklist_goals" ADD COLUMN "optional" INTEGER NOT NULL DEFAULT 0;
