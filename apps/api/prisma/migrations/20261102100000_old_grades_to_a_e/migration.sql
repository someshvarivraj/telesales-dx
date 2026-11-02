-- Telemarketing answer 11/2 (No.1): the call records saved under the old grades
-- (A アポ獲得 / B 保留 / C 不可 / D 不通) are test data; rewrite them to the A–E judgements.
-- Only records from before the A–E grades went live on staging (2026-10-30 12:44 JST) and
-- without a detailed result are touched; later records already use A–E.
UPDATE "call_records"
SET "result_code" = CASE "grade"
    WHEN 'B' THEN 'B-02' -- 保留 → 再リサーチ：改めて電話
    WHEN 'C' THEN 'C-01' -- 不可 → テレマ一旦ストップ：断
    WHEN 'D' THEN 'D-01' -- 不通 → テレマストップ：電話不通・他社・他家
  END
WHERE "result_code" IS NULL
  AND "grade" IN ('B', 'C', 'D')
  AND "created_at" < TIMESTAMPTZ '2026-10-30 03:44:00+00';
-- A (アポ獲得 → アポ確定) keeps its meaning and needs no detailed result.
