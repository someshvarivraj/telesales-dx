-- Plans keep a 件名 and, for visits and online meetings, the other company (feedback 11/2).
ALTER TABLE "schedule_plans" ADD COLUMN "company_name" VARCHAR(200);

-- Until now the title of a visit was the company name.
UPDATE "schedule_plans"
SET "company_name" = "title"
WHERE "type" IN ('VISIT', 'ONLINE') AND "appointment_id" IS NULL;
