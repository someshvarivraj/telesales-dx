-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "body" VARCHAR(500);

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "flag_match_id" UUID,
ADD COLUMN     "listing_status" VARCHAR(20);

-- AlterTable
ALTER TABLE "call_records" ALTER COLUMN "result_detail" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "schedule_plans" ADD COLUMN     "note" TEXT,
ADD COLUMN     "series_id" UUID;

-- CreateTable
CREATE TABLE "app_settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "schedule_plans_series_id_idx" ON "schedule_plans"("series_id");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_flag_match_id_fkey" FOREIGN KEY ("flag_match_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =====================================================================
-- Initial values (admins can rename, add or disable them on screen)
-- =====================================================================
INSERT INTO "option_items" ("id", "category", "code", "label", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'interest_level',   'HIGH',      '高い',         1, now()),
  (gen_random_uuid(), 'interest_level',   'MEDIUM',    '普通',         2, now()),
  (gen_random_uuid(), 'interest_level',   'LOW',       '低い',         3, now()),
  (gen_random_uuid(), 'meeting_response', 'GOOD',      '良い',         1, now()),
  (gen_random_uuid(), 'meeting_response', 'FAIR',      '普通',         2, now()),
  (gen_random_uuid(), 'meeting_response', 'POOR',      '難しい',       3, now()),
  (gen_random_uuid(), 'deal_status',      'OPPORTUNITY','案件あり',    1, now()),
  (gen_random_uuid(), 'deal_status',      'NO_DEAL',   '案件なし',     2, now()),
  (gen_random_uuid(), 'deal_status',      'FOLLOW_UP', '継続フォロー', 3, now())
ON CONFLICT ("category", "code") DO NOTHING;

-- Travel time before/after plans (spec §7: value and warn/block being confirmed by sales).
INSERT INTO "app_settings" ("key", "value", "updated_at") VALUES
  ('travel_buffer', '{"minutes": 0, "mode": "WARN"}', now())
ON CONFLICT ("key") DO NOTHING;
