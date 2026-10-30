-- Telemarketing request 2026-10-29 (評価表): grades A–E and the detailed results under each,
-- 「C架電回避目安」 (months before calling again).

-- AlterTable
ALTER TABLE "call_records" ADD COLUMN     "avoid_months" INTEGER,
ADD COLUMN     "avoid_until" DATE,
ADD COLUMN     "result_code" VARCHAR(48);

-- Grades A–E (E: not counted as a call).
INSERT INTO "option_items" ("id", "category", "code", "label", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'call_grade', 'A', 'アポ確定', 1, now()),
  (gen_random_uuid(), 'call_grade', 'B', '再リサーチ', 2, now()),
  (gen_random_uuid(), 'call_grade', 'C', 'テレマ一旦ストップ', 3, now()),
  (gen_random_uuid(), 'call_grade', 'D', 'テレマストップ', 4, now()),
  (gen_random_uuid(), 'call_grade', 'E', '回避（カウント対象外）', 5, now())
ON CONFLICT ("category", "code") DO UPDATE SET "label" = EXCLUDED."label", "sort_order" = EXCLUDED."sort_order", "is_active" = true, "updated_at" = now();

-- Detailed results, coded <grade>-<nn>.
INSERT INTO "option_items" ("id", "category", "code", "label", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'call_result', 'A-01', '訪問決定、案件有', 1, now()),
  (gen_random_uuid(), 'call_result', 'A-02', '訪問決定、案件無', 2, now()),
  (gen_random_uuid(), 'call_result', 'A-03', 'その他', 3, now()),
  (gen_random_uuid(), 'call_result', 'B-01', '離席、外出、コールなど', 4, now()),
  (gen_random_uuid(), 'call_result', 'B-02', '改めて電話', 5, now()),
  (gen_random_uuid(), 'call_result', 'B-03', '資料送付', 6, now()),
  (gen_random_uuid(), 'call_result', 'B-04', '営業より電話', 7, now()),
  (gen_random_uuid(), 'call_result', 'B-05', 'エリア保留', 8, now()),
  (gen_random_uuid(), 'call_result', 'B-06', 'その他', 9, now()),
  (gen_random_uuid(), 'call_result', 'C-01', '断', 10, now()),
  (gen_random_uuid(), 'call_result', 'C-02', '本社一括', 11, now()),
  (gen_random_uuid(), 'call_result', 'C-03', '親会社・グループ会社一括', 12, now()),
  (gen_random_uuid(), 'call_result', 'C-04', '指定業者', 13, now()),
  (gen_random_uuid(), 'call_result', 'C-05', 'HPよりお問い合わせ', 14, now()),
  (gen_random_uuid(), 'call_result', 'C-06', '同じところにつながる、近番など', 15, now()),
  (gen_random_uuid(), 'call_result', 'C-07', '同業者', 16, now()),
  (gen_random_uuid(), 'call_result', 'C-08', '対象外', 17, now()),
  (gen_random_uuid(), 'call_result', 'C-09', '遠隔地', 18, now()),
  (gen_random_uuid(), 'call_result', 'C-10', '営業訪問先', 19, now()),
  (gen_random_uuid(), 'call_result', 'C-11', 'その他', 20, now()),
  (gen_random_uuid(), 'call_result', 'D-01', '電話不通・他社・他家', 21, now()),
  (gen_random_uuid(), 'call_result', 'D-02', '抹消希望', 22, now()),
  (gen_random_uuid(), 'call_result', 'D-03', 'トラブル企業', 23, now()),
  (gen_random_uuid(), 'call_result', 'D-04', 'その他', 24, now()),
  (gen_random_uuid(), 'call_result', 'E-01', '回避', 25, now()),
  (gen_random_uuid(), 'call_result', 'E-02', 'リスト重複', 26, now())
ON CONFLICT ("category", "code") DO NOTHING;
