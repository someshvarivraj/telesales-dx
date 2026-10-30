-- ご意見・不具合の報告 (feedback from every screen) and its notice N20.

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "reporter_id" UUID NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "body" TEXT NOT NULL,
    "screen_path" VARCHAR(500) NOT NULL,
    "screen_name" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "resolution" TEXT,
    "handled_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feedback_number_key" ON "feedback"("number");

-- CreateIndex
CREATE INDEX "feedback_status_created_at_idx" ON "feedback"("status", "created_at");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- N20: mailed to the people set on 管理 → 通知 (admins by default) and the sender.
-- Resolutions are mailed to the same list.
INSERT INTO "notice_settings" ("code", "name", "is_enabled", "sends_email", "send_time", "days_before", "updated_at") VALUES
  ('N20', 'ご意見・不具合の報告',         true,  true,  NULL,    '{}',    now())
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "notice_recipients" ("id", "notice_code", "field", "kind", "value") VALUES
  (gen_random_uuid(), 'N20', 'TO', 'ROLE',    'ADMIN'),
  (gen_random_uuid(), 'N20', 'TO', 'CONTEXT', 'REPORTER')
ON CONFLICT DO NOTHING;
