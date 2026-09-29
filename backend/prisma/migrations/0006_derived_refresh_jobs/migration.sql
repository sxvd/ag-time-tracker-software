CREATE TABLE "derived_refresh_jobs" (
  "user_id" TEXT NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "derived_refresh_jobs_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "derived_refresh_jobs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
