-- Request 2026-10-29: 企業ランク, 親会社名 and テレマメモ on companies.

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "company_rank" VARCHAR(48),
ADD COLUMN     "parent_name" VARCHAR(100),
ADD COLUMN     "telema_memo" TEXT;


-- 企業ランク choices (editable on 管理 → 選択肢).
INSERT INTO "option_items" ("id", "category", "code", "label", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'company_rank', 'LISTED', '上場', 1, now()),
  (gen_random_uuid(), 'company_rank', 'LISTED_GROUP', '上系', 2, now()),
  (gen_random_uuid(), 'company_rank', 'EXCELLENT', '優良', 3, now()),
  (gen_random_uuid(), 'company_rank', 'UNLISTED', '非上場', 4, now()),
  (gen_random_uuid(), 'company_rank', 'SME', '中小企業', 5, now()),
  (gen_random_uuid(), 'company_rank', 'EXCLUDED', '対象外', 6, now())
ON CONFLICT ("category", "code") DO NOTHING;

-- Companies whose listing status already names a rank (e.g. 上場 from the handover PDF).
UPDATE "companies" c SET "company_rank" = o."code"
FROM "option_items" o
WHERE o."category" = 'company_rank' AND o."label" = c."listing_status" AND c."company_rank" IS NULL;
