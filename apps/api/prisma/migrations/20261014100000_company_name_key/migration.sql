-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "name_key" VARCHAR(200) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "company_former_names" ADD COLUMN     "name_key" VARCHAR(200) NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "companies_name_key_idx" ON "companies"("name_key");

-- CreateIndex
CREATE INDEX "company_former_names_name_key_idx" ON "company_former_names"("name_key");

