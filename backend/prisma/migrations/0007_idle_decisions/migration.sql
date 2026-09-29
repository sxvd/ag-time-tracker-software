ALTER TABLE "time_entries"
  ADD COLUMN "excluded_idle_seconds" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "entry_idle_decisions" (
  "entry_id" TEXT NOT NULL,
  "decision_id" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "ended_at" TIMESTAMP(3) NOT NULL,
  "idle_seconds" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "entry_idle_decisions_pkey"
    PRIMARY KEY ("entry_id", "decision_id"),
  CONSTRAINT "entry_idle_decisions_entry_id_fkey"
    FOREIGN KEY ("entry_id") REFERENCES "time_entries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
