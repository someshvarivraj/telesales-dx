-- Request 2026-10-29 ②: 「自動割り振りする／しない」 chosen when a list is imported.

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "auto_allocate" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "list_imports" ADD COLUMN     "auto_allocate" BOOLEAN NOT NULL DEFAULT true;

