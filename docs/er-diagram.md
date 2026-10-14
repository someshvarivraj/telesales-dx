# ER 図（データベース）

`apps/api/prisma/schema.prisma` と `apps/api/prisma/migrations/` から作成しています。PostgreSQL 16 を使います。
User は多くのテーブルから参照されるため、図を業務ごとに分けています。どの図でも `users` は同じテーブルです。

記号の意味：`PK` 主キー、`FK` 外部キー、`UK` 一意。
`||--o{` は「1 対 0 件以上」、`|o--o{` は「0 か 1 対 0 件以上」です。

## 1. 全体像

```mermaid
erDiagram
    users ||--o{ user_app_roles : "ロール"
    companies ||--o{ call_records : "架電"
    companies ||--o{ appointments : "アポ"
    call_records |o--o{ appointments : "架電からアポ"
    appointments ||--o| schedule_plans : "予定に1件だけ出る"
    appointments ||--o{ appointment_preparations : "事前準備"
    appointments ||--o{ meeting_results : "商談結果"
    appointments ||--o{ comments : "コメント"
    appointments ||--o{ appointment_changes : "変更履歴"
    appointments ||--o{ change_requests : "変更依頼"
    appointments |o--o{ outbound_emails : "メール"
    users ||--o{ appointments : "担当営業・取得者"
    users ||--o{ schedule_plans : "予定"
    users ||--o{ time_off : "休み"
    users ||--o{ slot_locks : "枠の押さえ"
    sales_area_rules }o--|| users : "担当営業"
    list_imports ||--o{ companies : "取込"
    stored_files ||--o{ list_imports : "元ファイル"
```

## 2. ユーザー・権限・監査

```mermaid
erDiagram
    users {
        uuid id PK
        varchar employee_no UK
        varchar name
        varchar email UK
        text password_hash
        enum status "ACTIVE / DISABLED"
        bool must_change_password
        int failed_login_count
        timestamptz locked_until
        timestamptz last_login_at
        timestamptz password_changed_at
    }
    apps {
        varchar key PK
        varchar name
        bool maintenance_mode
    }
    user_app_roles {
        uuid id PK
        uuid user_id FK
        varchar app_key FK
        enum role "TELEMA / TELEMA_LEAD / SALES / VIEWER / ADMIN"
    }
    user_permission_grants {
        uuid id PK
        uuid user_id FK
        varchar app_key FK
        varchar permission
        uuid granted_by_id FK
    }
    audit_logs {
        bigint id PK
        uuid actor_user_id FK
        varchar action
        varchar target_type
        varchar target_id
        json before
        json after
        varchar ip_address
        json metadata
    }
    session {
        varchar sid PK
        json sess
        timestamp expire
    }

    users ||--o{ user_app_roles : "持つ"
    apps ||--o{ user_app_roles : ""
    users ||--o{ user_permission_grants : "個別権限"
    users |o--o{ user_permission_grants : "付与した人"
    apps ||--o{ user_permission_grants : ""
    users |o--o{ audit_logs : "操作した人"
```

- `user_app_roles` は (user_id, app_key, role) で一意です。1 人が複数のロールを持てます。
- `user_permission_grants` は「エリア表を任された人」のような個別の例外をデータで持ちます。
- `session` は connect-pg-simple 用です。列名は変えられません。

## 3. 架電状況共有（企業・リスト・架電）

```mermaid
erDiagram
    companies {
        uuid id PK
        varchar name
        varchar name_key "重複チェック用に正規化した名前"
        varchar phone
        varchar phone_digits "数字だけ"
        varchar address
        varchar prefecture
        varchar city
        varchar customer_type
        varchar client_no
        varchar listing_status "上場など"
        enum flag "NONE / DUPLICATE / NEEDS_CHECK"
        uuid flag_match_id FK
        bool is_call_target
        json extra "新しいリストの追加列"
        uuid parent_id FK
        uuid company_group_id FK
        uuid list_import_id FK
        uuid created_by_id FK
    }
    company_former_names {
        uuid id PK
        uuid company_id FK
        varchar name
        varchar name_key
        timestamptz changed_at
    }
    company_groups {
        uuid id PK
        varchar name UK
        bool is_active
    }
    list_imports {
        uuid id PK
        enum purpose "CALL_REQUEST / REGISTER_ONLY"
        varchar list_name
        uuid file_id FK
        uuid imported_by_id FK
        int row_count
        int created_count
        int duplicate_count
        int check_count
        int error_count
    }
    call_records {
        uuid id PK
        uuid company_id FK
        uuid telemarketer_id FK
        timestamptz called_at
        varchar grade "選択肢 call_grade"
        text result_detail
        varchar contact_name
        varchar interest_level
        date next_call_date
        text notes
        uuid list_import_id FK
    }
    sales_area_rules {
        uuid id PK
        varchar prefecture
        varchar city
        varchar customer_type_condition
        uuid company_group_id FK
        uuid sales_rep_id FK
        uuid backup_rep_id FK
        bool web_only
        date valid_from
        date valid_to
    }
    stored_files {
        uuid id PK
        varchar storage_key UK
        varchar original_name
        int size_bytes
        char sha256
    }
    users {
        uuid id PK
    }

    companies ||--o{ company_former_names : "旧社名"
    companies |o--o{ companies : "親会社 parent_id"
    companies |o--o{ companies : "重複の相手 flag_match_id"
    company_groups |o--o{ companies : ""
    company_groups |o--o{ sales_area_rules : ""
    list_imports |o--o{ companies : "取り込んだ企業"
    list_imports |o--o{ call_records : ""
    stored_files ||--o{ list_imports : "元ファイル"
    companies ||--o{ call_records : "架電履歴"
    users ||--o{ call_records : "テレマ"
    users ||--o{ list_imports : "取り込んだ人"
    users ||--o{ sales_area_rules : "担当営業"
    users |o--o{ sales_area_rules : "代わりの営業"
```

- 電話番号が同じなら `DUPLICATE`（解消するまで架電対象から外します）、社名だけが同じなら `NEEDS_CHECK` です。
- 担当営業はエリア（都道府県・市区町村）、取引区分、企業グループ、有効期間から `sales_area_rules` で決めます。

## 4. アポ（データの中心）

```mermaid
erDiagram
    appointments {
        uuid id PK
        uuid company_id FK
        uuid source_call_record_id FK
        uuid sales_rep_id FK
        timestamptz starts_at
        timestamptz ends_at
        enum format "VISIT / ONLINE"
        varchar visit_address
        varchar contact_name
        varchar contact_phone
        varchar contact_email
        text handover_notes
        varchar customer_type
        bool is_new_appointment
        varchar list_name
        uuid booked_by_id FK
        timestamptz booked_at
        varchar meeting_url
        timestamptz sales_confirmed_at
        enum day_before_result "CONFIRMED / NOT_REACHED / CHANGED"
        uuid day_before_checked_by_id FK
        enum status "SCHEDULED / COMPLETED / CANCELLED"
        enum source "CALL_STATUS / FILE / MANUAL / SALES_BOOKED"
        uuid original_appointment_id FK
        uuid source_file_id FK
        char source_file_hash UK
        uuid cancelled_by_id FK
        int version "楽観ロック"
    }
    appointment_preparations {
        uuid id PK
        uuid appointment_id FK
        uuid author_id FK
        text note
    }
    preparation_attachments {
        uuid id PK
        uuid preparation_id FK
        uuid file_id FK
    }
    meeting_results {
        uuid id PK
        uuid appointment_id FK
        uuid author_id FK
        date visited_on
        varchar attendee
        text discussion
        varchar response
        varchar deal_status
        text next_action
        date next_action_date
    }
    comments {
        uuid id PK
        uuid appointment_id FK
        uuid call_record_id FK
        uuid parent_id FK
        uuid author_id FK
        text body
        timestamptz deleted_at
    }
    appointment_changes {
        uuid id PK
        uuid appointment_id FK
        uuid changed_by_id FK
        enum reason "OUR_SIDE モ変 / CUSTOMER_SIDE 先変"
        json before
        json after
    }
    change_requests {
        uuid id PK
        uuid appointment_id FK
        uuid requested_by_id FK
        text message
        enum status "REQUESTED / IN_PROGRESS / DONE / WITHDRAWN"
        uuid handler_id FK
        timestamptz taken_at
        timestamptz done_at
    }
    companies {
        uuid id PK
    }
    call_records {
        uuid id PK
    }
    stored_files {
        uuid id PK
    }
    users {
        uuid id PK
    }

    companies ||--o{ appointments : ""
    call_records |o--o{ appointments : "元の架電"
    appointments |o--o{ appointments : "取り直し original_appointment_id"
    stored_files |o--o{ appointments : "取込元ファイル"
    users ||--o{ appointments : "担当営業 / 取得者"
    users |o--o{ appointments : "前日確認した人 / キャンセルした人"
    appointments ||--o{ appointment_preparations : ""
    appointment_preparations ||--o{ preparation_attachments : ""
    stored_files ||--o{ preparation_attachments : ""
    appointments ||--o{ meeting_results : ""
    appointments |o--o{ comments : ""
    call_records |o--o{ comments : ""
    comments |o--o{ comments : "返信 parent_id"
    appointments ||--o{ appointment_changes : ""
    appointments ||--o{ change_requests : ""
    users ||--o{ change_requests : "依頼した人"
    users |o--o{ change_requests : "対応した人"
```

- リスケは同じアポを動かして `appointment_changes` に前後の値を残します。新しいアポを作るのはキャンセル後の取り直しだけです（`original_appointment_id`）。
- `comments` は、アポか架電記録の**どちらか一方**に付きます（CHECK 制約）。
- `source_file_hash` が一意なので、同じファイルを二重に登録できません。

## 5. スケジュール

```mermaid
erDiagram
    schedule_plans {
        uuid id PK
        uuid owner_id FK
        uuid created_by_id FK
        varchar type "選択肢 plan_type"
        timestamptz starts_at
        timestamptz ends_at
        bool all_day
        varchar title
        enum status "FIXED / TENTATIVE"
        uuid candidate_group_id
        bool holiday_work
        uuid series_id "繰り返しで作った予定"
        text note
        uuid appointment_id FK,UK
        timestamptz deleted_at
    }
    plan_attendees {
        uuid plan_id PK,FK
        uuid user_id PK,FK
    }
    time_off {
        uuid id PK
        uuid user_id FK
        uuid entered_by_id FK
        enum kind "DAY_OFF / LATE_START / EARLY_LEAVE / PARTIAL"
        timestamptz starts_at
        timestamptz ends_at
        bool all_day
        timestamptz deleted_at
    }
    slot_locks {
        uuid id PK
        uuid sales_rep_id FK
        uuid locked_by_id FK
        timestamptz starts_at
        timestamptz ends_at
        timestamptz heartbeat_at
        timestamptz expires_at
    }
    calendar_days {
        date date PK
        varchar name
        enum kind "PUBLIC_HOLIDAY / COMPANY_HOLIDAY"
    }
    appointments {
        uuid id PK
    }
    users {
        uuid id PK
    }

    users ||--o{ schedule_plans : "予定の持ち主"
    users ||--o{ schedule_plans : "作成者"
    appointments ||--o| schedule_plans : "アポ1件 = 予定1件"
    schedule_plans ||--o{ plan_attendees : "同行者"
    users ||--o{ plan_attendees : ""
    users ||--o{ time_off : "休む人 / 入力者"
    users ||--o{ slot_locks : "営業 / 押さえた人"
```

- 二重予約は次の順で防ぎます。
  1. 担当営業ごとの advisory lock
  2. `slot_locks` による枠の押さえ（ハートビートで延長し、120 秒で切れます）
  3. 最後の砦として、同じ持ち主の予定が時間帯で重ならないようにする `EXCLUDE USING gist` 制約
- `calendar_days` は営業日ではない日です。祝日は内閣府の CSV から取り込み、会社休日は管理者が入力します。

## 6. 通知・メール・設定・ファイル

```mermaid
erDiagram
    notice_settings {
        varchar code PK "N1〜N19"
        varchar name
        bool is_enabled
        bool sends_email
        varchar send_time "例 12:00 JST"
        int_array days_before
    }
    notice_recipients {
        uuid id PK
        varchar notice_code FK
        enum field "TO / CC"
        enum kind "EMAIL / USER / ROLE / CONTEXT"
        varchar value
    }
    notifications {
        uuid id PK
        uuid user_id FK
        varchar notice_code
        varchar title
        varchar body
        varchar link_path
        timestamptz read_at
    }
    outbound_emails {
        uuid id PK
        varchar notice_code
        varchar dedupe_key UK "1回だけ送る"
        text_array to
        text_array cc
        varchar subject
        text body
        text_array attachment_ids
        enum status "DRAFT / QUEUED / SENT / FAILED"
        uuid appointment_id FK
        uuid created_by_id FK
        timestamptz sent_at
    }
    stored_files {
        uuid id PK
        varchar storage_key UK
        varchar original_name
        varchar content_type
        int size_bytes
        char sha256
        uuid uploaded_by_id FK
    }
    option_items {
        uuid id PK
        varchar category
        varchar code
        varchar label
        int sort_order
        bool is_active
    }
    app_settings {
        varchar key PK
        json value
    }
    appointments {
        uuid id PK
    }
    users {
        uuid id PK
    }

    notice_settings ||--o{ notice_recipients : "宛先"
    users ||--o{ notifications : "ベル通知"
    appointments |o--o{ outbound_emails : ""
    users |o--o{ outbound_emails : "作成者"
    users |o--o{ stored_files : "アップロードした人"
```

- `option_items` は (category, code) で一意です。選択肢は削除せず無効にします。
- `app_settings` には移動時間バッファなどを持ちます。
- `outbound_emails.dedupe_key` の例は `N1:{アポID}`、`N4:{日付}:{営業ID}`、`N19:{日付}` です。

## 7. テレマ管理（優先度 2・テーブルのみ）

```mermaid
erDiagram
    telemarketer_profiles {
        uuid user_id PK,FK
        varchar job_type
        bool is_allocation_target
        text_array territory
    }
    shifts {
        uuid id PK
        uuid user_id FK
        date date
        varchar kind
        varchar start_time
        varchar end_time
        int break_minutes
        int working_minutes
    }
    allocations {
        uuid id PK
        date date
        enum kind "CALL / DAY_BEFORE"
        uuid company_id FK
        uuid appointment_id FK
        uuid assignee_id FK
        enum status "DRAFT / CONFIRMED"
    }
    users {
        uuid id PK
    }
    companies {
        uuid id PK
    }
    appointments {
        uuid id PK
    }

    users ||--o| telemarketer_profiles : ""
    users ||--o{ shifts : "(user_id, date) で一意"
    users ||--o{ allocations : "割り振り先"
    companies |o--o{ allocations : "架電の割り振り"
    appointments |o--o{ allocations : "前日確認の割り振り"
```

## DB 側の制約（マイグレーション SQL で追加）

| テーブル                                           | 制約                                                                                                                                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| appointments, schedule_plans, time_off, slot_locks | `CHECK (ends_at > starts_at)`                                                                                                                                                                                    |
| comments                                           | `CHECK ((appointment_id IS NULL) <> (call_record_id IS NULL))`                                                                                                                                                   |
| schedule_plans                                     | `EXCLUDE USING gist (owner_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE appointment_id IS NOT NULL AND deleted_at IS NULL`：同じ営業のアポの予定が重ならないようにします（btree_gist 拡張を使います） |
