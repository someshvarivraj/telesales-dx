-- Priority 2: telemarketing shifts and auto allocation, scheduled reminders, next-action list.
-- AlterTable
ALTER TABLE "allocations" ADD COLUMN     "confirmed_at" TIMESTAMPTZ(6),
ADD COLUMN     "confirmed_by_id" UUID;

-- AlterTable
ALTER TABLE "meeting_results" ADD COLUMN     "next_action_done_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupe_key" VARCHAR(120);

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "entered_by_id" UUID,
ADD COLUMN     "note" VARCHAR(200);

-- AlterTable
ALTER TABLE "telemarketer_profiles" ADD COLUMN     "usual_break_minutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "usual_end" VARCHAR(5),
ADD COLUMN     "usual_start" VARCHAR(5),
ADD COLUMN     "usual_weekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_dedupe_key_key" ON "notifications"("user_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "shifts_date_idx" ON "shifts"("date");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

