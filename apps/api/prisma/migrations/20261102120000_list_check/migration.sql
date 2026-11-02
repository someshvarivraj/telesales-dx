-- listcheck in the app (Sano 10/28 ②): 掲載元のURL, the 回避企業 list, removed-row counts.
ALTER TABLE "companies" ADD COLUMN "source_url" VARCHAR(1000);

ALTER TYPE "ListImportRowStatus" ADD VALUE 'AVOIDED';
ALTER TYPE "ListImportRowStatus" ADD VALUE 'NO_PHONE';

ALTER TABLE "list_imports" ADD COLUMN "avoided_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "list_imports" ADD COLUMN "no_phone_count" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "AvoidSource" AS ENUM ('LIST', 'CALL');

CREATE TABLE "avoid_phones" (
    "id" UUID NOT NULL,
    "phone_digits" VARCHAR(15) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "company_name" VARCHAR(200),
    "source" "AvoidSource" NOT NULL,
    "company_id" UUID,
    "untargeted_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avoid_phones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "avoid_phones_phone_digits_key" ON "avoid_phones"("phone_digits");

ALTER TABLE "avoid_phones" ADD CONSTRAINT "avoid_phones_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
