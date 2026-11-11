-- Request 11/11 (Sano-san): every feature also sends e-mail, from the company address set in
-- MAIL_FROM. Each notice can still be turned back to 「画面のみ」 in 管理 → 通知の宛先.
UPDATE "notice_settings" SET "sends_email" = true, "updated_at" = now() WHERE "sends_email" = false;
