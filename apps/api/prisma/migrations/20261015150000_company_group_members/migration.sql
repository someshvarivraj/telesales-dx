-- Companies that belong to a group by name (e.g. the 注力企業 list).
CREATE TABLE "company_group_members" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "name_key" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_group_members_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_group_members_name_key_idx" ON "company_group_members"("name_key");

CREATE UNIQUE INDEX "company_group_members_group_id_name_key_key" ON "company_group_members"("group_id", "name_key");

ALTER TABLE "company_group_members" ADD CONSTRAINT "company_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "company_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
