ALTER TABLE "entry_pauses" ALTER COLUMN "ended_at" DROP NOT NULL;
ALTER TABLE "entry_pauses" ALTER COLUMN "duration_seconds" DROP NOT NULL;

CREATE UNIQUE INDEX "uq_entry_pauses_one_open_per_entry"
  ON "entry_pauses"("entry_id")
  WHERE "ended_at" IS NULL;
