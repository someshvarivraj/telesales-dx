-- 11/2 feedback: 電話 / その他 formats, the online tool, the person met.
ALTER TYPE "MeetingFormat" ADD VALUE 'PHONE';
ALTER TYPE "MeetingFormat" ADD VALUE 'OTHER';

ALTER TABLE "appointments" ADD COLUMN "online_tool" VARCHAR(50);
ALTER TABLE "appointments" ADD COLUMN "format_note" VARCHAR(100);
ALTER TABLE "appointments" ADD COLUMN "meeting_person_name" VARCHAR(100);
