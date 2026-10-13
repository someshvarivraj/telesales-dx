-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('TELEMA', 'TELEMA_LEAD', 'SALES', 'VIEWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "HolidayKind" AS ENUM ('PUBLIC_HOLIDAY', 'COMPANY_HOLIDAY');

-- CreateEnum
CREATE TYPE "RecipientField" AS ENUM ('TO', 'CC');

-- CreateEnum
CREATE TYPE "RecipientKind" AS ENUM ('EMAIL', 'USER', 'ROLE', 'CONTEXT');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "CompanyFlag" AS ENUM ('NONE', 'DUPLICATE', 'NEEDS_CHECK');

-- CreateEnum
CREATE TYPE "ListImportPurpose" AS ENUM ('CALL_REQUEST', 'REGISTER_ONLY');

-- CreateEnum
CREATE TYPE "MeetingFormat" AS ENUM ('VISIT', 'ONLINE');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('CALL_STATUS', 'FILE', 'MANUAL', 'SALES_BOOKED');

-- CreateEnum
CREATE TYPE "DayBeforeResult" AS ENUM ('CONFIRMED', 'NOT_REACHED', 'CHANGED');

-- CreateEnum
CREATE TYPE "ChangeReason" AS ENUM ('OUR_SIDE', 'CUSTOMER_SIDE');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'DONE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('FIXED', 'TENTATIVE');

-- CreateEnum
CREATE TYPE "TimeOffKind" AS ENUM ('DAY_OFF', 'LATE_START', 'EARLY_LEAVE', 'PARTIAL');

-- CreateEnum
CREATE TYPE "AllocationKind" AS ENUM ('CALL', 'DAY_BEFORE');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- Users: add the new columns, copy existing data, then drop the old columns (end of file)
ALTER TABLE "users" ADD COLUMN "employee_no" VARCHAR(32),
ADD COLUMN "name" VARCHAR(100),
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
UPDATE "users" SET "name" = "display_name",
  "status" = CASE WHEN "is_active" THEN 'ACTIVE'::"UserStatus" ELSE 'DISABLED'::"UserStatus" END;
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN "after" JSONB,
ADD COLUMN "before" JSONB;

-- CreateTable
CREATE TABLE "apps" (
    "key" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "user_app_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "app_key" VARCHAR(32) NOT NULL,
    "role" "AppRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_app_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "app_key" VARCHAR(32) NOT NULL,
    "permission" VARCHAR(64) NOT NULL,
    "granted_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_days" (
    "date" DATE NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "kind" "HolidayKind" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_days_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "option_items" (
    "id" UUID NOT NULL,
    "category" VARCHAR(48) NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "option_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_settings" (
    "code" VARCHAR(8) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sends_email" BOOLEAN NOT NULL DEFAULT false,
    "send_time" VARCHAR(5),
    "days_before" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notice_settings_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "notice_recipients" (
    "id" UUID NOT NULL,
    "notice_code" VARCHAR(8) NOT NULL,
    "field" "RecipientField" NOT NULL DEFAULT 'TO',
    "kind" "RecipientKind" NOT NULL,
    "value" VARCHAR(254) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notice_code" VARCHAR(8) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "link_path" VARCHAR(300),
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_emails" (
    "id" UUID NOT NULL,
    "notice_code" VARCHAR(8) NOT NULL,
    "dedupe_key" VARCHAR(200),
    "to" TEXT[],
    "cc" TEXT[],
    "subject" VARCHAR(300) NOT NULL,
    "body" TEXT NOT NULL,
    "attachment_ids" TEXT[],
    "status" "EmailStatus" NOT NULL DEFAULT 'DRAFT',
    "appointment_id" UUID,
    "created_by_id" UUID,
    "sent_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "storage_key" VARCHAR(300) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(127) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_area_rules" (
    "id" UUID NOT NULL,
    "prefecture" VARCHAR(10) NOT NULL,
    "city" VARCHAR(50),
    "customer_type_condition" VARCHAR(48),
    "company_group_id" UUID,
    "sales_rep_id" UUID NOT NULL,
    "backup_rep_id" UUID,
    "web_only" BOOLEAN NOT NULL DEFAULT false,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sales_area_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "office" VARCHAR(100),
    "department" VARCHAR(100),
    "phone" VARCHAR(32),
    "phone_digits" VARCHAR(15),
    "url" VARCHAR(500),
    "address" VARCHAR(300),
    "prefecture" VARCHAR(10),
    "city" VARCHAR(50),
    "nearest_station" VARCHAR(100),
    "industry" VARCHAR(100),
    "customer_type" VARCHAR(48),
    "client_no" VARCHAR(32),
    "telema_id_no" VARCHAR(32),
    "list_name" VARCHAR(200),
    "flag" "CompanyFlag" NOT NULL DEFAULT 'NONE',
    "is_call_target" BOOLEAN NOT NULL DEFAULT false,
    "extra" JSONB,
    "parent_id" UUID,
    "company_group_id" UUID,
    "created_by_id" UUID,
    "list_import_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_former_names" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_former_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_imports" (
    "id" UUID NOT NULL,
    "purpose" "ListImportPurpose" NOT NULL,
    "list_name" VARCHAR(200) NOT NULL,
    "file_id" UUID NOT NULL,
    "imported_by_id" UUID NOT NULL,
    "row_count" INTEGER NOT NULL,
    "created_count" INTEGER NOT NULL,
    "duplicate_count" INTEGER NOT NULL,
    "check_count" INTEGER NOT NULL,
    "error_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "list_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_records" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "telemarketer_id" UUID NOT NULL,
    "called_at" TIMESTAMPTZ(6) NOT NULL,
    "grade" VARCHAR(48) NOT NULL,
    "result_detail" VARCHAR(48),
    "contact_name" VARCHAR(100),
    "interest_level" VARCHAR(48),
    "next_call_date" DATE,
    "notes" TEXT,
    "list_import_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "call_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "source_call_record_id" UUID,
    "sales_rep_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "format" "MeetingFormat" NOT NULL,
    "visit_address" VARCHAR(300),
    "contact_name" VARCHAR(100),
    "contact_department" VARCHAR(100),
    "contact_phone" VARCHAR(64),
    "contact_email" VARCHAR(254),
    "handover_notes" TEXT,
    "customer_type" VARCHAR(48),
    "is_new_appointment" BOOLEAN NOT NULL DEFAULT false,
    "list_name" VARCHAR(200),
    "booked_by_id" UUID NOT NULL,
    "booked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meeting_url" VARCHAR(500),
    "sales_confirmed_at" TIMESTAMPTZ(6),
    "day_before_result" "DayBeforeResult",
    "day_before_checked_by_id" UUID,
    "day_before_checked_at" TIMESTAMPTZ(6),
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "source" "AppointmentSource" NOT NULL,
    "original_appointment_id" UUID,
    "source_file_id" UUID,
    "source_file_hash" CHAR(64),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_preparations" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointment_preparations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preparation_attachments" (
    "id" UUID NOT NULL,
    "preparation_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,

    CONSTRAINT "preparation_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_results" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "visited_on" DATE NOT NULL,
    "attendee" VARCHAR(100),
    "discussion" TEXT NOT NULL,
    "response" VARCHAR(48),
    "deal_status" VARCHAR(48),
    "next_action" TEXT,
    "next_action_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "meeting_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "appointment_id" UUID,
    "call_record_id" UUID,
    "parent_id" UUID,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_changes" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "reason" "ChangeReason",
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "handler_id" UUID,
    "taken_at" TIMESTAMPTZ(6),
    "done_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_plans" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "type" VARCHAR(48) NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "title" VARCHAR(200) NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'FIXED',
    "candidate_group_id" UUID,
    "holiday_work" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" VARCHAR(200),
    "appointment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "schedule_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_attendees" (
    "plan_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "plan_attendees_pkey" PRIMARY KEY ("plan_id","user_id")
);

-- CreateTable
CREATE TABLE "time_off" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entered_by_id" UUID NOT NULL,
    "kind" "TimeOffKind" NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "note" VARCHAR(200),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "time_off_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_locks" (
    "id" UUID NOT NULL,
    "sales_rep_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "locked_by_id" UUID NOT NULL,
    "heartbeat_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telemarketer_profiles" (
    "user_id" UUID NOT NULL,
    "job_type" VARCHAR(48),
    "is_allocation_target" BOOLEAN NOT NULL DEFAULT true,
    "territory" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "telemarketer_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "kind" VARCHAR(48) NOT NULL,
    "start_time" VARCHAR(5),
    "end_time" VARCHAR(5),
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "working_minutes" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "kind" "AllocationKind" NOT NULL,
    "company_id" UUID,
    "appointment_id" UUID,
    "assignee_id" UUID NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_app_roles_user_id_app_key_role_key" ON "user_app_roles"("user_id", "app_key", "role");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_grants_user_id_app_key_permission_key" ON "user_permission_grants"("user_id", "app_key", "permission");

-- CreateIndex
CREATE INDEX "option_items_category_is_active_sort_order_idx" ON "option_items"("category", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "option_items_category_code_key" ON "option_items"("category", "code");

-- CreateIndex
CREATE UNIQUE INDEX "notice_recipients_notice_code_field_kind_value_key" ON "notice_recipients"("notice_code", "field", "kind", "value");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_emails_dedupe_key_key" ON "outbound_emails"("dedupe_key");

-- CreateIndex
CREATE INDEX "outbound_emails_status_created_at_idx" ON "outbound_emails"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storage_key_key" ON "stored_files"("storage_key");

-- CreateIndex
CREATE INDEX "stored_files_sha256_idx" ON "stored_files"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "company_groups_name_key" ON "company_groups"("name");

-- CreateIndex
CREATE INDEX "sales_area_rules_prefecture_city_idx" ON "sales_area_rules"("prefecture", "city");

-- CreateIndex
CREATE INDEX "companies_phone_digits_idx" ON "companies"("phone_digits");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_is_call_target_flag_idx" ON "companies"("is_call_target", "flag");

-- CreateIndex
CREATE INDEX "company_former_names_name_idx" ON "company_former_names"("name");

-- CreateIndex
CREATE INDEX "call_records_company_id_called_at_idx" ON "call_records"("company_id", "called_at");

-- CreateIndex
CREATE INDEX "call_records_telemarketer_id_called_at_idx" ON "call_records"("telemarketer_id", "called_at");

-- CreateIndex
CREATE INDEX "call_records_next_call_date_idx" ON "call_records"("next_call_date");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_source_file_hash_key" ON "appointments"("source_file_hash");

-- CreateIndex
CREATE INDEX "appointments_sales_rep_id_starts_at_idx" ON "appointments"("sales_rep_id", "starts_at");

-- CreateIndex
CREATE INDEX "appointments_starts_at_idx" ON "appointments"("starts_at");

-- CreateIndex
CREATE INDEX "appointments_booked_by_id_booked_at_idx" ON "appointments"("booked_by_id", "booked_at");

-- CreateIndex
CREATE INDEX "appointments_company_id_idx" ON "appointments"("company_id");

-- CreateIndex
CREATE INDEX "appointment_preparations_appointment_id_created_at_idx" ON "appointment_preparations"("appointment_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "preparation_attachments_preparation_id_file_id_key" ON "preparation_attachments"("preparation_id", "file_id");

-- CreateIndex
CREATE INDEX "meeting_results_appointment_id_created_at_idx" ON "meeting_results"("appointment_id", "created_at");

-- CreateIndex
CREATE INDEX "meeting_results_author_id_next_action_date_idx" ON "meeting_results"("author_id", "next_action_date");

-- CreateIndex
CREATE INDEX "comments_appointment_id_created_at_idx" ON "comments"("appointment_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_call_record_id_created_at_idx" ON "comments"("call_record_id", "created_at");

-- CreateIndex
CREATE INDEX "appointment_changes_appointment_id_created_at_idx" ON "appointment_changes"("appointment_id", "created_at");

-- CreateIndex
CREATE INDEX "change_requests_status_created_at_idx" ON "change_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_plans_appointment_id_key" ON "schedule_plans"("appointment_id");

-- CreateIndex
CREATE INDEX "schedule_plans_owner_id_starts_at_idx" ON "schedule_plans"("owner_id", "starts_at");

-- CreateIndex
CREATE INDEX "schedule_plans_candidate_group_id_idx" ON "schedule_plans"("candidate_group_id");

-- CreateIndex
CREATE INDEX "time_off_user_id_starts_at_idx" ON "time_off"("user_id", "starts_at");

-- CreateIndex
CREATE INDEX "slot_locks_sales_rep_id_starts_at_idx" ON "slot_locks"("sales_rep_id", "starts_at");

-- CreateIndex
CREATE INDEX "slot_locks_expires_at_idx" ON "slot_locks"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_user_id_date_key" ON "shifts"("user_id", "date");

-- CreateIndex
CREATE INDEX "allocations_date_kind_assignee_id_idx" ON "allocations"("date", "kind", "assignee_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_no_key" ON "users"("employee_no");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx" ON "audit_logs"("target_type", "target_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_app_roles" ADD CONSTRAINT "user_app_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_app_roles" ADD CONSTRAINT "user_app_roles_app_key_fkey" FOREIGN KEY ("app_key") REFERENCES "apps"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_app_key_fkey" FOREIGN KEY ("app_key") REFERENCES "apps"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_recipients" ADD CONSTRAINT "notice_recipients_notice_code_fkey" FOREIGN KEY ("notice_code") REFERENCES "notice_settings"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_emails" ADD CONSTRAINT "outbound_emails_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_emails" ADD CONSTRAINT "outbound_emails_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_area_rules" ADD CONSTRAINT "sales_area_rules_company_group_id_fkey" FOREIGN KEY ("company_group_id") REFERENCES "company_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_area_rules" ADD CONSTRAINT "sales_area_rules_sales_rep_id_fkey" FOREIGN KEY ("sales_rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_area_rules" ADD CONSTRAINT "sales_area_rules_backup_rep_id_fkey" FOREIGN KEY ("backup_rep_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_company_group_id_fkey" FOREIGN KEY ("company_group_id") REFERENCES "company_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_list_import_id_fkey" FOREIGN KEY ("list_import_id") REFERENCES "list_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_former_names" ADD CONSTRAINT "company_former_names_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_imports" ADD CONSTRAINT "list_imports_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "list_imports" ADD CONSTRAINT "list_imports_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_telemarketer_id_fkey" FOREIGN KEY ("telemarketer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_list_import_id_fkey" FOREIGN KEY ("list_import_id") REFERENCES "list_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_source_call_record_id_fkey" FOREIGN KEY ("source_call_record_id") REFERENCES "call_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_sales_rep_id_fkey" FOREIGN KEY ("sales_rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_booked_by_id_fkey" FOREIGN KEY ("booked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_day_before_checked_by_id_fkey" FOREIGN KEY ("day_before_checked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_original_appointment_id_fkey" FOREIGN KEY ("original_appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_source_file_id_fkey" FOREIGN KEY ("source_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_preparations" ADD CONSTRAINT "appointment_preparations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_preparations" ADD CONSTRAINT "appointment_preparations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preparation_attachments" ADD CONSTRAINT "preparation_attachments_preparation_id_fkey" FOREIGN KEY ("preparation_id") REFERENCES "appointment_preparations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preparation_attachments" ADD CONSTRAINT "preparation_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_results" ADD CONSTRAINT "meeting_results_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_results" ADD CONSTRAINT "meeting_results_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_call_record_id_fkey" FOREIGN KEY ("call_record_id") REFERENCES "call_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_changes" ADD CONSTRAINT "appointment_changes_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_changes" ADD CONSTRAINT "appointment_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_handler_id_fkey" FOREIGN KEY ("handler_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_plans" ADD CONSTRAINT "schedule_plans_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_plans" ADD CONSTRAINT "schedule_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_plans" ADD CONSTRAINT "schedule_plans_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_attendees" ADD CONSTRAINT "plan_attendees_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "schedule_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_attendees" ADD CONSTRAINT "plan_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_locks" ADD CONSTRAINT "slot_locks_sales_rep_id_fkey" FOREIGN KEY ("sales_rep_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slot_locks" ADD CONSTRAINT "slot_locks_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telemarketer_profiles" ADD CONSTRAINT "telemarketer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- =====================================================================
-- Data migration: single role column -> user_app_roles (several roles per user)
-- =====================================================================
INSERT INTO "apps" ("key", "name") VALUES ('telesales', 'テレマ・営業DX');

INSERT INTO "user_app_roles" ("id", "user_id", "app_key", "role")
SELECT gen_random_uuid(), "id", 'telesales', "role"::text::"AppRole" FROM "users";

INSERT INTO "user_app_roles" ("id", "user_id", "app_key", "role")
SELECT gen_random_uuid(), "id", 'telesales', 'TELEMA_LEAD'::"AppRole" FROM "users" WHERE "is_team_lead";

DROP INDEX "users_role_idx";
ALTER TABLE "users" DROP COLUMN "display_name",
DROP COLUMN "is_active",
DROP COLUMN "is_team_lead",
DROP COLUMN "role";
DROP TYPE "Role";

-- =====================================================================
-- Integrity rules the ORM cannot express
-- =====================================================================
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_order" CHECK ("ends_at" > "starts_at");
ALTER TABLE "schedule_plans" ADD CONSTRAINT "schedule_plans_time_order" CHECK ("ends_at" > "starts_at");
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_time_order" CHECK ("ends_at" > "starts_at");
ALTER TABLE "slot_locks" ADD CONSTRAINT "slot_locks_time_order" CHECK ("ends_at" > "starts_at");
ALTER TABLE "comments" ADD CONSTRAINT "comments_single_target"
  CHECK (("appointment_id" IS NULL) <> ("call_record_id" IS NULL));

-- No double booking (spec §2-11): two live appointment plans of the same rep may never overlap.
-- This is the final guard on save; the service also checks and locks the slot while editing.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "schedule_plans" ADD CONSTRAINT "schedule_plans_no_overlapping_appointments"
  EXCLUDE USING gist ("owner_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("appointment_id" IS NOT NULL AND "deleted_at" IS NULL);

-- =====================================================================
-- Reference data (initial values from spec v1 §8, §12). Admins edit these on screen.
-- =====================================================================
INSERT INTO "option_items" ("id", "category", "code", "label", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'call_grade', 'A', 'アポ獲得', 1, now()),
  (gen_random_uuid(), 'call_grade', 'B', '保留', 2, now()),
  (gen_random_uuid(), 'call_grade', 'C', '不可', 3, now()),
  (gen_random_uuid(), 'call_grade', 'D', '不通', 4, now()),
  (gen_random_uuid(), 'customer_type', 'NEW', '新規', 1, now()),
  (gen_random_uuid(), 'customer_type', 'RENEWED', '新再', 2, now()),
  (gen_random_uuid(), 'customer_type', 'CURRENT', '現取', 3, now()),
  (gen_random_uuid(), 'customer_type', 'FORMER', '旧取', 4, now()),
  (gen_random_uuid(), 'plan_type', 'VISIT', '訪問', 1, now()),
  (gen_random_uuid(), 'plan_type', 'ONLINE', 'オンライン', 2, now()),
  (gen_random_uuid(), 'plan_type', 'INTERNAL', '社内', 3, now()),
  (gen_random_uuid(), 'plan_type', 'TRIP', '出張', 4, now()),
  (gen_random_uuid(), 'plan_type', 'EVENT', '展示会', 5, now()),
  (gen_random_uuid(), 'plan_type', 'OTHER', 'その他', 6, now());

INSERT INTO "notice_settings" ("code", "name", "is_enabled", "sends_email", "send_time", "days_before", "updated_at") VALUES
  ('N1',  'アポ登録のメール',             true,  true,  NULL,    '{}',    now()),
  ('N2',  '会議リンク発行のお願い',       true,  false, NULL,    '{}',    now()),
  ('N3',  '会議URLが未登録',              true,  false, '09:00', '{3,1}', now()),
  ('N4',  '翌日のアポのメール',           true,  true,  '12:00', '{1}',   now()),
  ('N6',  '日程変更のお知らせ',           true,  false, NULL,    '{}',    now()),
  ('N7',  '変更依頼のお知らせ',           true,  false, NULL,    '{}',    now()),
  ('N8',  '取り消しのお知らせ',           true,  false, NULL,    '{}',    now()),
  ('N9',  '同席者に入った',               true,  false, NULL,    '{}',    now()),
  ('N10', '他の人が予定を変えた',         true,  false, NULL,    '{}',    now()),
  ('N11', '今日の担当',                   true,  false, NULL,    '{}',    now()),
  ('N12', '前日確認が未入力',             true,  false, '15:00', '{1}',   now()),
  ('N13', '変更依頼が未対応',             false, false, NULL,    '{}',    now()),
  ('N14', '前日確認の結果（12時以降）',   true,  true,  NULL,    '{}',    now()),
  ('N15', '仮予定の期限切れ',             true,  false, '09:00', '{}',    now()),
  ('N16', '打ち合わせ結果が入った',       true,  false, NULL,    '{}',    now()),
  ('N17', '架電を依頼するリストが入った', true,  false, NULL,    '{}',    now()),
  ('N18', '質問・コメントが付いた',       true,  false, NULL,    '{}',    now()),
  ('N19', 'その日のアポ取得一覧',         true,  true,  '17:00', '{}',    now());

-- Context recipients are resolved per event. Fixed addresses (計数営業部, 全社営業…) are added by admins.
INSERT INTO "notice_recipients" ("id", "notice_code", "field", "kind", "value") VALUES
  (gen_random_uuid(), 'N1',  'TO', 'CONTEXT', 'ASSIGNED_REP'),
  (gen_random_uuid(), 'N1',  'CC', 'ROLE',    'TELEMA'),
  (gen_random_uuid(), 'N2',  'TO', 'CONTEXT', 'ASSIGNED_REP'),
  (gen_random_uuid(), 'N3',  'TO', 'CONTEXT', 'ASSIGNED_REP'),
  (gen_random_uuid(), 'N4',  'TO', 'CONTEXT', 'ASSIGNED_REP'),
  (gen_random_uuid(), 'N6',  'TO', 'CONTEXT', 'ASSIGNED_REP_BEFORE'),
  (gen_random_uuid(), 'N6',  'TO', 'CONTEXT', 'ASSIGNED_REP'),
  (gen_random_uuid(), 'N6',  'TO', 'CONTEXT', 'BOOKER'),
  (gen_random_uuid(), 'N7',  'TO', 'ROLE',    'TELEMA'),
  (gen_random_uuid(), 'N8',  'TO', 'CONTEXT', 'ASSIGNED_REP'),
  (gen_random_uuid(), 'N9',  'TO', 'CONTEXT', 'ATTENDEES'),
  (gen_random_uuid(), 'N10', 'TO', 'CONTEXT', 'PLAN_OWNER'),
  (gen_random_uuid(), 'N11', 'TO', 'CONTEXT', 'ASSIGNEE'),
  (gen_random_uuid(), 'N12', 'TO', 'ROLE',    'TELEMA'),
  (gen_random_uuid(), 'N12', 'TO', 'ROLE',    'TELEMA_LEAD'),
  (gen_random_uuid(), 'N13', 'TO', 'ROLE',    'TELEMA'),
  (gen_random_uuid(), 'N14', 'TO', 'CONTEXT', 'ASSIGNED_REP'),
  (gen_random_uuid(), 'N15', 'TO', 'CONTEXT', 'PLAN_OWNER'),
  (gen_random_uuid(), 'N16', 'TO', 'CONTEXT', 'BOOKER'),
  (gen_random_uuid(), 'N16', 'TO', 'ROLE',    'VIEWER'),
  (gen_random_uuid(), 'N17', 'TO', 'ROLE',    'TELEMA'),
  (gen_random_uuid(), 'N18', 'TO', 'CONTEXT', 'RECORD_AUTHOR'),
  (gen_random_uuid(), 'N18', 'TO', 'CONTEXT', 'ASSIGNED_REP'),
  (gen_random_uuid(), 'N18', 'TO', 'CONTEXT', 'THREAD'),
  (gen_random_uuid(), 'N19', 'TO', 'ROLE',    'TELEMA');
