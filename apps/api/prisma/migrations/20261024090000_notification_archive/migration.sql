-- Notifications can be archived (kept, but out of the inbox), as in Teams' activity feed.
ALTER TABLE "notifications" ADD COLUMN "archived_at" TIMESTAMPTZ(6);
CREATE INDEX "notifications_user_id_archived_at_created_at_idx" ON "notifications"("user_id", "archived_at", "created_at");
