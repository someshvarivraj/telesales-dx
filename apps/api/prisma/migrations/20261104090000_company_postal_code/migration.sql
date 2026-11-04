-- 郵便番号 as a company field: searched in 詳細検索 (request 11/2). Lists kept it among the extras.
ALTER TABLE "companies" ADD COLUMN "postal_code" VARCHAR(10);

UPDATE "companies"
SET "postal_code" = LEFT("extra" ->> '郵便番号', 10)
WHERE "extra" ? '郵便番号' AND COALESCE("extra" ->> '郵便番号', '') <> '';
