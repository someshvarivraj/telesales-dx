-- One company can come in on many lists; one appointment can come from a CSV and a PDF together.
-- Existing data is carried over before the old columns are dropped.

-- CreateEnum
CREATE TYPE "ListImportRowStatus" AS ENUM ('IMPORTED', 'DUPLICATE', 'NEEDS_CHECK', 'INVALID');

-- CreateEnum
CREATE TYPE "SourceFileType" AS ENUM ('EXISTING_LIST_CSV', 'HANDOVER_PDF', 'OTHER');

-- =====================================================================
-- list_import_rows: the bridge between imported files and companies
-- =====================================================================
CREATE TABLE "list_import_rows" (
    "id" UUID NOT NULL,
    "list_import_id" UUID NOT NULL,
    "company_id" UUID,
    "row_number" INTEGER NOT NULL,
    "raw_data" JSONB NOT NULL,
    "status" "ListImportRowStatus" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "list_import_rows_pkey" PRIMARY KEY ("id")
);

-- Backfill from companies.list_import_id. The original row numbers and raw values were not kept,
-- so rows are numbered in registration order and raw_data holds the values the company was created with.
INSERT INTO "list_import_rows" ("id", "list_import_id", "company_id", "row_number", "raw_data", "status", "created_at")
SELECT
    gen_random_uuid(),
    c."list_import_id",
    c."id",
    ROW_NUMBER() OVER (PARTITION BY c."list_import_id" ORDER BY c."created_at", c."id") + 1,
    jsonb_strip_nulls(jsonb_build_object('会社名', c."name", '電話番号', c."phone", 'URL', c."url", '住所', c."address")),
    CASE c."flag"
        WHEN 'DUPLICATE' THEN 'DUPLICATE'::"ListImportRowStatus"
        WHEN 'NEEDS_CHECK' THEN 'NEEDS_CHECK'::"ListImportRowStatus"
        ELSE 'IMPORTED'::"ListImportRowStatus"
    END,
    c."created_at"
FROM "companies" c
WHERE c."list_import_id" IS NOT NULL;

ALTER TABLE "companies" DROP CONSTRAINT "companies_list_import_id_fkey";
ALTER TABLE "companies" DROP COLUMN "list_import_id";

CREATE UNIQUE INDEX "list_import_rows_list_import_id_row_number_key" ON "list_import_rows"("list_import_id", "row_number");
CREATE INDEX "list_import_rows_company_id_idx" ON "list_import_rows"("company_id");
ALTER TABLE "list_import_rows" ADD CONSTRAINT "list_import_rows_list_import_id_fkey" FOREIGN KEY ("list_import_id") REFERENCES "list_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "list_import_rows" ADD CONSTRAINT "list_import_rows_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- appointment_source_files: CSV, PDF or both per appointment
-- =====================================================================
CREATE TABLE "appointment_source_files" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "source_type" "SourceFileType" NOT NULL,
    "row_number" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_source_files_pkey" PRIMARY KEY ("id")
);

INSERT INTO "appointment_source_files" ("id", "appointment_id", "file_id", "source_type", "created_at")
SELECT
    gen_random_uuid(),
    a."id",
    a."source_file_id",
    CASE WHEN f."content_type" = 'application/pdf' OR lower(f."original_name") LIKE '%.pdf'
        THEN 'HANDOVER_PDF'::"SourceFileType"
        ELSE 'EXISTING_LIST_CSV'::"SourceFileType"
    END,
    a."created_at"
FROM "appointments" a
JOIN "stored_files" f ON f."id" = a."source_file_id";

ALTER TABLE "appointments" DROP CONSTRAINT "appointments_source_file_id_fkey";
ALTER TABLE "appointments" DROP COLUMN "source_file_id";

-- The value is a fingerprint of the imported record (file hashes + CSV row), not of a whole file.
ALTER TABLE "appointments" RENAME COLUMN "source_file_hash" TO "source_fingerprint";
ALTER INDEX "appointments_source_file_hash_key" RENAME TO "appointments_source_fingerprint_key";

CREATE UNIQUE INDEX "appointment_source_files_appointment_id_file_id_key" ON "appointment_source_files"("appointment_id", "file_id");
CREATE INDEX "appointment_source_files_file_id_idx" ON "appointment_source_files"("file_id");
ALTER TABLE "appointment_source_files" ADD CONSTRAINT "appointment_source_files_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_source_files" ADD CONSTRAINT "appointment_source_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- Timestamps and indexes for frequent queries
-- =====================================================================
ALTER TABLE "preparation_attachments" ADD COLUMN "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "companies_prefecture_city_idx" ON "companies"("prefecture", "city");
CREATE INDEX "companies_customer_type_idx" ON "companies"("customer_type");
CREATE INDEX "appointments_status_starts_at_idx" ON "appointments"("status", "starts_at");
CREATE INDEX "slot_locks_sales_rep_id_expires_at_idx" ON "slot_locks"("sales_rep_id", "expires_at");
