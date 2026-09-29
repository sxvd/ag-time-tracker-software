ALTER TABLE "settings"
  ALTER COLUMN "nudge_cadence_minutes" SET DEFAULT 50;

UPDATE "settings"
SET "nudge_cadence_minutes" = 50
WHERE "nudge_cadence_minutes" = 90;
