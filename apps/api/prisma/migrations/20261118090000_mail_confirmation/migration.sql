-- Sano 11/18: every e-mail a person's action causes is checked on a confirmation screen first.
-- Such mails wait as DRAFT; "送らない" marks them DISCARDED (kept for the record, never sent).
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'DISCARDED';
