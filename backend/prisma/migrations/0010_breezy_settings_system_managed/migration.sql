ALTER TABLE "settings"
  ALTER COLUMN "breezy_verbosity" SET DEFAULT 'gentle',
  ALTER COLUMN "muted" SET DEFAULT false;

UPDATE "settings"
SET
  "nudge_cadence_minutes" = 50,
  "breezy_verbosity" = 'gentle',
  "muted" = false;
