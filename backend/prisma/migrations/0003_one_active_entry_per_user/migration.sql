DO $$
BEGIN
  IF EXISTS (
    SELECT user_id
    FROM time_entries
    WHERE ended_at IS NULL
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one active entry per user: duplicate active rows exist';
  END IF;
END $$;

CREATE UNIQUE INDEX uq_time_entries_one_active_per_user
ON time_entries(user_id)
WHERE ended_at IS NULL;
