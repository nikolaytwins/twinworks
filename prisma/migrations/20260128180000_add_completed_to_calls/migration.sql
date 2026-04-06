-- Add completed flag to calls for tracking done events
ALTER TABLE "calls" ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false;

