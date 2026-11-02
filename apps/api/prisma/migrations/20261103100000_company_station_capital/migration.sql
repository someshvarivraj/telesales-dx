-- 11/2 feedback: walking minutes from the station, 資本金 as a number.
ALTER TABLE "companies" ADD COLUMN "walk_minutes" SMALLINT;
ALTER TABLE "companies" ADD COLUMN "capital" BIGINT;

-- 資本金 already imported as an extra column: written like 「1154000000」 or 「1,154,000,000」.
UPDATE "companies"
SET "capital" = REPLACE("extra"->>'資本金', ',', '')::BIGINT,
    "extra" = NULLIF("extra" - '資本金', '{}'::jsonb)
WHERE "extra" ? '資本金' AND REPLACE("extra"->>'資本金', ',', '') ~ '^[0-9]{1,15}$';
