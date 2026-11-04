-- 一括修正: the same change to many companies, with the previous values kept to undo it (11/2).
CREATE TABLE "company_bulk_edits" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "applied" JSONB NOT NULL,
    "changes" JSONB NOT NULL,
    "company_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restored_at" TIMESTAMPTZ(6),
    "restored_by_id" UUID,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "company_bulk_edits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_bulk_edit_items" (
    "id" UUID NOT NULL,
    "bulk_edit_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "before" JSONB NOT NULL,

    CONSTRAINT "company_bulk_edit_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_bulk_edits_created_at_idx" ON "company_bulk_edits"("created_at");
CREATE INDEX "company_bulk_edit_items_bulk_edit_id_idx" ON "company_bulk_edit_items"("bulk_edit_id");
CREATE INDEX "company_bulk_edit_items_company_id_idx" ON "company_bulk_edit_items"("company_id");

ALTER TABLE "company_bulk_edits" ADD CONSTRAINT "company_bulk_edits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "company_bulk_edits" ADD CONSTRAINT "company_bulk_edits_restored_by_id_fkey" FOREIGN KEY ("restored_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "company_bulk_edit_items" ADD CONSTRAINT "company_bulk_edit_items_bulk_edit_id_fkey" FOREIGN KEY ("bulk_edit_id") REFERENCES "company_bulk_edits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_bulk_edit_items" ADD CONSTRAINT "company_bulk_edit_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
