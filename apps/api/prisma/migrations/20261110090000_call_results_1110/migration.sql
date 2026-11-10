-- Telemarketing answers 11/10 (確認事項 No.2):
-- ① B-01 reads 「離席、外出、コールなど」 (full-width コール; 離席、外出 kept).
-- ② Grade C is called 「断」 instead of 「テレマ一旦ストップ」.
-- ③ 「その他」 under E.
UPDATE "option_items" SET "label" = '離席、外出、コールなど', "updated_at" = now()
WHERE "category" = 'call_result' AND "code" = 'B-01';

UPDATE "option_items" SET "label" = '断', "updated_at" = now()
WHERE "category" = 'call_grade' AND "code" = 'C';

INSERT INTO "option_items" ("id", "category", "code", "label", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'call_result', 'E-03', 'その他', 27, now())
ON CONFLICT ("category", "code") DO UPDATE SET "label" = EXCLUDED."label", "is_active" = true, "updated_at" = now();
