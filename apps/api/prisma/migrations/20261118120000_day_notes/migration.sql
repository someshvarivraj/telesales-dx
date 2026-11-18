-- 11/18: a short note on one person's day, typed in the day's header on the schedule.
CREATE TABLE "day_notes" (
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "text" VARCHAR(200) NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "day_notes_pkey" PRIMARY KEY ("user_id","date")
);

ALTER TABLE "day_notes" ADD CONSTRAINT "day_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "day_notes" ADD CONSTRAINT "day_notes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
