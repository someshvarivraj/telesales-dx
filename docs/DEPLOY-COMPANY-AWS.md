# Deploying テレマ・営業DX to the company AWS account — step by step

> **Update, 2026-10-22 — how staging actually deploys.** The infrastructure owner set up a
> stricter design than steps 6–8 and 10 below, and `.github/workflows/deploy.yml` now
> follows it:
>
> - GitHub Actions builds both images (app = `runtime`, tools = `builder`) and pushes them
>   to ECR: `telesales-dx-staging-app` and `telesales-dx-staging-tools`.
> - It then runs the SSM document **`telesales-dx-staging-deploy`** on the instance with
>   three values only — the two image digests (`sha256:…`) and the 40-character commit.
>   The document calls `/opt/apps/telesales-dx/ops/request-staging-deploy.py` on the
>   server, which pulls exactly those digests, migrates and restarts. The server never
>   builds and the role cannot run arbitrary shell commands.
> - The role `telesales-dx-github-deploy-staging` may only: send that one document to
>   that one instance, read the result, and push to those two ECR repositories.
>
> The trust policy must accept GitHub's immutable subject for this repository
> (`repo:someshvarivraj@*/telesales-dx@*:ref:refs/heads/main`) as well as the plain one;
> `docs/ci-cd/trust-policy.json` has both. Repository variable `VITE_BASE_PATH` must match
> the path the app is served under (e.g. `/telesales-dx/`), because it is baked into the
> image at build time.

**For:** whoever sets up production in the company's AWS account (Raturi-san)
**Result:** the app running as **`telesales-dx`** on the company's existing EC2
instance, next to the apps already there, at
**`https://dx.morabu.com/telesales-dx`** (recommended, the same way as
`skill-sheet-2`) — and redeployed automatically every time a pull request is
merged into `main`.

This is the hands-on runbook: every command, in order, with the values for the
company server already filled in. It follows the same pattern as the
skill-sheet project's `DEPLOY-COMPANY-AWS.md` (Docker Compose on the shared
instance, secrets in Parameter Store, deploys over SSM with GitHub OIDC — no
access keys stored anywhere).

## The company server at a glance

| Item                                           | Value                                                                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| AWS account                                    | `889002527739`                                                                                                                          |
| Region                                         | `ap-northeast-1` (Tokyo)                                                                                                                |
| Instance                                       | Amazon Linux 2023, 2 vCPU, 3.7 GB RAM (shared with the other apps)                                                                      |
| Instance role                                  | `morabu-dx-ec2-role` — already has `AmazonSSMManagedInstanceCore`                                                                       |
| Web server                                     | nginx on 80/443, certificates by certbot                                                                                                |
| Already running                                | `dx.morabu.com`, `/opt/apps/skill-sheet-2` (port 3100), `/opt/apps/skill-sheet`, pedometer, network-monitor, a Next.js app on port 3000 |
| Already installed (by the skill-sheet-2 setup) | Docker + compose + buildx, cron, 2 GB swap — step 5 only checks them                                                                    |
| Timezone                                       | UTC (the app works in JST internally; nothing to change)                                                                                |

**Everything this app creates is named `telesales-dx`** — nothing that exists
is renamed, replaced or reused:

| What                           | Where                                                                 |
| ------------------------------ | --------------------------------------------------------------------- |
| Code (git checkout)            | `/opt/apps/telesales-dx`                                              |
| Database files, uploaded files | `/var/lib/telesales-dx/`                                              |
| Nightly database backups       | `/var/backups/telesales-dx/`                                          |
| App port (local only)          | `127.0.0.1:3200` (3000 and 3100 are taken)                            |
| Containers                     | `telesales-dx-app-1`, `telesales-dx-db-1`                             |
| nginx                          | `/etc/nginx/snippets/telesales-dx.conf` + one `include` line (step 9) |
| Secrets                        | Parameter Store `/telesales-dx/*`                                     |
| Deploy role                    | IAM role `telesales-dx-github-deploy`                                 |

**Ground rule for a shared server:** add, never replace. Install only what is
missing, add permissions to the existing role, add new files, and don't change
server-wide settings.

Placeholders to fill in as you go:

| Placeholder           | Meaning                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `<INSTANCE_ID>`       | the instance ID (`i-...`) — step 1 prints it                             |
| `<ADMIN_EMAIL>`       | the first admin's `@morabu.com` address (step 8)                         |
| `<MAIL_FROM_ADDRESS>` | sender address for the app's mails, e.g. `telesales@morabu.com` (step 7) |

Where the commands run:

- **CloudShell** = AWS console → CloudShell icon (top bar), **account
  `889002527739`, region Tokyo**. Prompt looks like `~ $`.
- **Instance** = EC2 console → the instance → **Connect → Session Manager →
  Connect**, then `sudo -i`. Prompt looks like `[root@ip-... ~]#`.

A command meant for the instance fails with "Permission denied" or "No such
file" in CloudShell — check the prompt first.

---

## 0. Before you start (decisions, not commands)

- [ ] **Server owner's OK** to add this app: two containers (app + PostgreSQL),
      one nginx `include` line in the `dx.morabu.com` site, and GitHub Actions
      triggering rebuilds on this server (step 10 explains exactly what that
      access is).
- [ ] **Address agreed:** `https://dx.morabu.com/telesales-dx` (recommended,
      no DNS work) — or a subdomain such as `telesales.morabu.com` (see the
      appendix; needs a DNS record and its own certificate).
- [ ] **Sender address** `<MAIL_FROM_ADDRESS>` agreed (an `@morabu.com`
      address; it does not need a mailbox).
- [ ] **GitHub admin** on `someshvarivraj/telesales-dx` (deploy key,
      repository variables, branch protection). If the repository moves to a
      company GitHub organization, do that **first** — the trust policy in
      step 10 names the repository.

## 1. Note the instance ID and check headroom (Instance, as root)

```bash
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id; echo
free -h      # "available" should be at least ~700 MB
df -h /      # at least ~5 GB free for the images, the database and backups
```

The first line is `<INSTANCE_ID>`. If memory or disk is short, stop here and
talk to the server owner: growing the volume is shown in step 5; a bigger
instance type is the owner's call.

## 2. Secrets in Parameter Store (CloudShell)

```bash
export AWS_REGION=ap-northeast-1

aws ssm put-parameter --name /telesales-dx/SESSION_SECRET --type SecureString \
  --value "$(openssl rand -base64 48)"
# hex, not base64: this ends up inside DATABASE_URL, where / + = would break it
aws ssm put-parameter --name /telesales-dx/POSTGRES_PASSWORD --type SecureString \
  --value "$(openssl rand -hex 24)"
```

## 3. Amazon SES (console, region Tokyo)

The app sends the notice mails (N1, N4, N19 …) through SES.

1. **SES → Identities.** `morabu.com` should already be **Verified** (the
   skill-sheet setup did this). If not: **Create identity → Domain** →
   `morabu.com`, Easy DKIM, add the 3 CNAME records and wait for **Verified**.
2. **SES → Account dashboard** → it must not say "sandbox" (in the sandbox,
   mail only reaches verified addresses). If it does, **Request production
   access** — approval takes up to a day.
3. **SES → SMTP settings → Create SMTP credentials** (a new pair for this app,
   so it can be revoked on its own), then store them (CloudShell):

```bash
aws ssm put-parameter --name /telesales-dx/SMTP_USER --type SecureString --value '<smtp username>'
aws ssm put-parameter --name /telesales-dx/SMTP_PASSWORD --type SecureString --value '<smtp password>'
```

## 4. Let the instance read its secrets (CloudShell)

Add one inline policy to `morabu-dx-ec2-role` that can read `/telesales-dx/*`
and nothing else — nothing existing is changed:

```bash
cat > telesales-dx-params.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
 "Action":["ssm:GetParameter","ssm:GetParameters"],
 "Resource":"arn:aws:ssm:ap-northeast-1:889002527739:parameter/telesales-dx/*"}]}
EOF
aws iam put-role-policy --role-name morabu-dx-ec2-role \
  --policy-name read-telesales-dx-params --policy-document file://telesales-dx-params.json
```

## 5. Prepare the server (Instance, as root)

**Check what the skill-sheet setup already installed** — each line should
print a version / a size. Install only what is missing (the commands are in
the skill-sheet runbook, step 5):

```bash
docker compose version && docker buildx version
systemctl is-active docker crond
swapon --show     # /swapfile 2G
```

**Folders for this app:**

```bash
mkdir -p /var/lib/telesales-dx/storage /var/lib/telesales-dx/postgres \
         /var/lib/telesales-dx/import /var/backups/telesales-dx
chown 1000:1000 /var/lib/telesales-dx/storage   # the app container runs as uid 1000 (node)
chmod 700 /var/lib/telesales-dx/import
```

**Disk (if step 1 showed less than ~5 GB free).** EC2 console → the instance
→ **Storage** → the volume → **Modify volume** → +10 GiB, wait for
"optimizing", then:

```bash
growpart /dev/nvme0n1 1 && xfs_growfs -d / && df -h /
```

## 6. Deploy key and first checkout (Instance, as root)

The automatic deploy runs as root via SSM, so the key lives under `/root`. The
`Host` alias applies only to this repository; the skill-sheet key is untouched.

```bash
mkdir -p /root/.ssh && chmod 700 /root/.ssh
ssh-keygen -t ed25519 -f /root/.ssh/telesales-dx-deploy -N "" -C telesales-dx-deploy
cat >> /root/.ssh/config <<'EOF'

Host github.com-telesales-dx
  HostName github.com
  User git
  IdentityFile /root/.ssh/telesales-dx-deploy
  IdentitiesOnly yes
EOF
chmod 600 /root/.ssh/config
grep -q '^github.com ' /root/.ssh/known_hosts 2>/dev/null || ssh-keyscan github.com >> /root/.ssh/known_hosts
cat /root/.ssh/telesales-dx-deploy.pub
```

Copy the whole printed line (`ssh-ed25519 ... telesales-dx-deploy`) to GitHub
→ `someshvarivraj/telesales-dx` → **Settings → Deploy keys → Add deploy key**,
title `company-ec2 telesales-dx`, **"Allow write access" unchecked**.

```bash
git clone git@github.com-telesales-dx:someshvarivraj/telesales-dx.git /opt/apps/telesales-dx
cd /opt/apps/telesales-dx && git log --oneline -1
# SSM runs deploys without HOME, so root's ~/.gitconfig is never read
git config --system --add safe.directory /opt/apps/telesales-dx
```

## 7. Environment files (Instance, as root)

Built from Parameter Store, so no secret is typed by hand. **No quotes around
values** — Docker reads quotes literally. Replace `<MAIL_FROM_ADDRESS>` first.

```bash
cd /opt/apps/telesales-dx
p() { aws ssm get-parameter --region ap-northeast-1 --with-decryption \
        --name "/telesales-dx/$1" --query Parameter.Value --output text; }
# SES SMTP passwords contain / and + — they must be URL-encoded inside SMTP_URL
enc() { python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"; }

# read by docker compose itself
cat > .env <<EOF
POSTGRES_PASSWORD=$(p POSTGRES_PASSWORD)
APP_PORT=3200
DATA_DIR=/var/lib/telesales-dx
VITE_BASE_PATH=/telesales-dx/
EOF

# read by the app
cat > .env.production <<EOF
NODE_ENV=production
API_PORT=3000
LOG_LEVEL=info
DATABASE_URL=postgresql://telesales:$(p POSTGRES_PASSWORD)@db:5432/telesales?schema=public

SESSION_SECRET=$(p SESSION_SECRET)
SESSION_IDLE_TIMEOUT_MINUTES=480
SESSION_ABSOLUTE_TIMEOUT_MINUTES=720
LOGIN_MAX_FAILED_ATTEMPTS=5
LOGIN_LOCK_MINUTES=15
TRUST_PROXY=true

APP_BASE_URL=https://dx.morabu.com/telesales-dx
WEB_DIST_DIR=/app/web
FILE_STORAGE_DIR=/app/storage

MAIL_FROM=テレマ・営業DX <<MAIL_FROM_ADDRESS>>
SMTP_URL=smtp://$(enc "$(p SMTP_USER)"):$(enc "$(p SMTP_PASSWORD)")@email-smtp.ap-northeast-1.amazonaws.com:587

JOBS_ENABLED=true
SLOT_LOCK_TTL_SECONDS=120
EOF
chmod 600 .env .env.production
grep -c '<MAIL_FROM_ADDRESS>' .env.production   # must print 0
```

Notes:

- `API_PORT=3000` is the port _inside_ the container; `APP_PORT=3200` is the
  port on the server.
- The database host is **`db`** (the compose service), not `127.0.0.1`.
- `VITE_BASE_PATH=/telesales-dx/` is baked into the build. It must match the
  nginx path in step 9 (for a subdomain instead, see the appendix).
- `APP_BASE_URL` is used for the links inside mails, so it must be the real
  final address.
- `JOBS_ENABLED=true` runs the scheduled notices (N3, N4, N12, N19 …) in this
  app. It must be `true` on exactly one server.

## 8. First start, database and first admin (Instance, as root)

```bash
cd /opt/apps/telesales-dx
C="docker compose -f docker-compose.prod.yml --env-file .env"

$C build app tools                      # several minutes of heavy CPU — pick a quiet time
$C up -d db
$C run --rm tools pnpm exec prisma migrate deploy
$C up -d app
$C ps                                   # db "healthy", app "healthy" after ~1 min
curl -s http://127.0.0.1:3200/health/ready; echo    # {"status":"ok"}
```

The migrations also load the setup data the app needs: the option lists
(判定 A–D, 取引区分 …), the 19 notices with their default recipients, and the
app settings. No companies, appointments or test users are created.

**The first admin** — prints a one-time temporary password, changed at first
sign-in. Share it through a secure channel, not in chat:

```bash
$C run --rm tools pnpm run user:create --email <ADMIN_EMAIL> --name "管理者" --roles ADMIN
```

Everything else (users, holidays, recipients, the area table) is then done on
the app's 管理 screens — except the area table's first load, step 13.

## 9. nginx: serve it at `dx.morabu.com/telesales-dx` (Instance, as root)

The existing `dx.morabu.com` site gets **one `include` line**; everything for
this app lives in its own snippet file. Back the site file up first.

```bash
SITE=$(grep -l 'server_name[^;]*dx\.morabu\.com' /etc/nginx/conf.d/*.conf); echo "$SITE"
cp -a "$SITE" "/root/$(basename "$SITE").before-telesales-dx"

mkdir -p /etc/nginx/snippets
cat > /etc/nginx/snippets/telesales-dx.conf <<'EOF'
# テレマ・営業DX — https://dx.morabu.com/telesales-dx/
location = /telesales-dx { return 301 /telesales-dx/; }
location /telesales-dx/ {
  # the trailing slash strips /telesales-dx before it reaches the app
  proxy_pass http://127.0.0.1:3200/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 25m;     # list CSVs, handover PDFs (the app allows 20 MB)
  proxy_read_timeout 120s;      # Excel reports
}
EOF
```

Now open `"$SITE"` (e.g. `nano "$SITE"`) and, inside the **`server { ... }`
block that has `listen 443`** and `server_name dx.morabu.com`, add this line
next to the other `location` blocks:

```nginx
    include /etc/nginx/snippets/telesales-dx.conf;
```

```bash
nginx -t && systemctl reload nginx
curl -s https://dx.morabu.com/telesales-dx/health/ready; echo    # {"status":"ok"}
```

`nginx -t` must say "syntax is ok" before it reloads. To undo: remove the
`include` line (or copy the backup from `/root` back) and reload — nothing
else is affected. The certificate is the existing one for `dx.morabu.com`.

## 10. CI/CD role for GitHub Actions (CloudShell)

**What this grants, so the server owner can agree to it:** merges into `main`
of this one repository can make AWS run shell commands **as root on this
instance** (that is how the deploy runs `git fetch`, the rebuild and the
migrations), and nothing else — no other instance, no other AWS service.
Each deploy rebuilds the image on the server: a few minutes of heavy CPU.

Upload `docs/ci-cd/trust-policy.json` and `docs/ci-cd/deploy-permissions.json`
from the repository to CloudShell (**Actions → Upload file**). In
`deploy-permissions.json` replace `<INSTANCE_ID>` (CloudShell:
`sed -i 's/<INSTANCE_ID>/i-.../' deploy-permissions.json`). The account,
region and repository are already filled in.

```bash
# GitHub as an identity provider — once per account; the skill-sheet setup
# already created it, so this should list token.actions.githubusercontent.com
aws iam list-open-id-connect-providers
# only if it is missing:
# aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com \
#   --client-id-list sts.amazonaws.com \
#   --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea 1c58a3a8518e8759bf075b76b750d4f2df264fcd

aws iam create-role --role-name telesales-dx-github-deploy \
  --assume-role-policy-document file://trust-policy.json
aws iam put-role-policy --role-name telesales-dx-github-deploy \
  --policy-name telesales-dx-deploy-permissions --policy-document file://deploy-permissions.json
aws iam get-role --role-name telesales-dx-github-deploy --query Role.Arn --output text
```

## 11. Point GitHub at the server and protect `main`

GitHub → `someshvarivraj/telesales-dx` → **Settings → Secrets and variables →
Actions → Variables** (the Variables tab, not Secrets):

| Variable              | Value                                 |
| --------------------- | ------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN` | the ARN printed at the end of step 10 |
| `DEPLOY_INSTANCE_ID`  | `<INSTANCE_ID>`                       |
| `AWS_REGION`          | `ap-northeast-1`                      |
| `DEPLOY_DIR`          | `/opt/apps/telesales-dx`              |
| `APP_URL`             | `https://dx.morabu.com/telesales-dx`  |

Then **Actions → Deploy to company EC2 → Run workflow** on `main`. It should
end with "Rebuild and restart on EC2" showing `DEPLOY_DONE` and "Check the
site answers" printing `{"status":"ok"}`.

**From now on, every pull request is checked, and every merge goes live:**

- On each pull request, the **CI** workflow runs lint, format, typecheck,
  tests and a build.
- When a pull request is merged into `main`, **Deploy to company EC2**
  rebuilds the server, runs any new database migrations, restarts the app and
  checks that the site answers. Deploys never overlap; a second merge waits.

To make the CI check mandatory: **Settings → Branches → Add branch ruleset**
(or "Add rule") for `main` → **Require a pull request before merging** and
**Require status checks to pass** → add **`verify`** (the CI job).

## 12. Backups (Instance, as root)

The server runs on UTC, so `30 18` = 03:30 in Japan (half an hour after the
skill-sheet backup, so they don't overlap).

```bash
cat > /etc/cron.d/telesales-dx-backup <<'EOF'
30 18 * * * root docker compose -f /opt/apps/telesales-dx/docker-compose.prod.yml --env-file /opt/apps/telesales-dx/.env exec -T db pg_dump -U telesales telesales | gzip > /var/backups/telesales-dx/$(date +\%Y\%m\%d).sql.gz
0 19 * * * root find /var/backups/telesales-dx -name '*.sql.gz' -mtime +90 -delete
EOF
chmod 644 /etc/cron.d/telesales-dx-backup
```

Uploaded files are in `/var/lib/telesales-dx/storage`. If daily EBS snapshots
of this instance are already taken (Lifecycle Manager), they cover both; if
not, ask the owner to add one — it protects the other apps too.

**Restore** (only when needed):

```bash
gunzip -c /var/backups/telesales-dx/<YYYYMMDD>.sql.gz | \
  docker compose -f /opt/apps/telesales-dx/docker-compose.prod.yml --env-file /opt/apps/telesales-dx/.env exec -T db psql -U telesales telesales
```

## 13. Load the sales area table (once, Instance as root)

The checked 営業担当表 workbook (`営業担当表（確認済分）_10-15.xlsx`) holds real
names, so it never goes into Git. It is copied to the server, loaded, and
deleted. Vraj provides the file.

1. On your PC, turn it into text and note its checksum:
   - Mac: `base64 -i 営業担当表（確認済分）_10-15.xlsx | pbcopy` and
     `shasum -a 256 営業担当表（確認済分）_10-15.xlsx`
   - Windows PowerShell:
     `[Convert]::ToBase64String([IO.File]::ReadAllBytes("営業担当表（確認済分）_10-15.xlsx")) | Set-Clipboard`
     and `Get-FileHash 営業担当表（確認済分）_10-15.xlsx`
2. On the instance:

```bash
cat > /var/lib/telesales-dx/import/area.b64     # paste, then Enter and Ctrl-D
base64 -d /var/lib/telesales-dx/import/area.b64 > /var/lib/telesales-dx/import/area.xlsx
sha256sum /var/lib/telesales-dx/import/area.xlsx   # must match the checksum from step 1

cd /opt/apps/telesales-dx
C="docker compose -f docker-compose.prod.yml --env-file .env"
$C run --rm tools pnpm run area:import --file /import/area.xlsx \
  --rep-name "中島=中島　慎之亮" --rep-name "白鳥=白鳥　大輔" --dry-run
#   → Rules: 208  Groups: 3  Reps: 9 (9 new)
$C run --rm tools pnpm run area:import --file /import/area.xlsx \
  --rep-name "中島=中島　慎之亮" --rep-name "白鳥=白鳥　大輔" --replace

shred -u /var/lib/telesales-dx/import/area.xlsx /var/lib/telesales-dx/import/area.b64
```

The import creates a 営業 account for each rep with a placeholder address
(`sales-rep-01@pending.invalid` …) and no usable password. On the app's
**管理 → ユーザー** screen, set each rep's real address and issue a password.
On **管理 → 営業担当表**, add the company names to the 「ポートアイランド」
group (it starts empty).

## 14. Verify

From any machine:

```bash
curl -s https://dx.morabu.com/telesales-dx/health/ready    # {"status":"ok"}
```

- [ ] `https://dx.morabu.com/telesales-dx/` shows the sign-in screen; a deep
      link such as `/telesales-dx/appointments` also opens (after sign-in)
- [ ] **`dx.morabu.com`, skill-sheet-2, the old skill-sheet, pedometer and
      network-monitor still work**
- [ ] Sign in as `<ADMIN_EMAIL>`, change the password when asked
- [ ] 管理 → 休日カレンダー → import the public holidays (needs outbound HTTPS
      to `www8.cao.go.jp`)
- [ ] Create a test appointment → the N1 mail **arrives** (SES out of sandbox)
- [ ] Upload a call list → `ls /var/lib/telesales-dx/storage` shows the file,
      and it is still there after a redeploy
- [ ] Merge a small pull request → the deploy runs and the change is live
- [ ] Next day: a `.sql.gz` in `/var/backups/telesales-dx`
- [ ] After a few days: `free -h` / `df -h /` still have headroom

**Disk housekeeping:** every deploy prunes the previous image. If space runs
low anyway, `docker builder prune -af` frees the build cache (it is shared
with skill-sheet-2's builds — they simply take longer the next time).

---

## Appendix A: a subdomain instead (e.g. `telesales.morabu.com`)

Only if step 0 chose a subdomain:

- Step 7: `VITE_BASE_PATH=/` in `.env`, and
  `APP_BASE_URL=https://telesales.morabu.com` in `.env.production`.
- Step 9 instead: add an `A` record for the subdomain → the instance's public
  IP, then a new site file (no existing file is edited):

```bash
DOMAIN=telesales.morabu.com
cat > /etc/nginx/conf.d/telesales-dx.conf <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name $DOMAIN;
  client_max_body_size 25m;
  location / {
    proxy_pass http://127.0.0.1:3200;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 120s;
  }
}
EOF
nginx -t && systemctl reload nginx
certbot --nginx -d $DOMAIN
```

- Step 11: `APP_URL=https://telesales.morabu.com`.

## Appendix B: day-to-day operations (Instance, as root)

```bash
cd /opt/apps/telesales-dx
C="docker compose -f docker-compose.prod.yml --env-file .env"
$C ps                                   # status
$C logs --tail 200 app                  # app logs
$C restart app                          # restart without rebuilding
$C run --rm tools pnpm exec prisma migrate status   # migrations applied?
```

A deploy that failed on the server shows its output in the GitHub Actions
run. Re-run it from **Actions → Deploy to company EC2 → Run workflow** once
the cause is fixed.

---

## Pitfalls these steps avoid

| Pitfall                                                                                        | What this runbook does                                                                        |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Overwriting skill-sheet-2 or the older skill-sheet                                             | separate folder, data dir, containers, port, secrets and nginx snippet, all `telesales-dx`    |
| Attaching a different role to the shared instance — removes the permissions the other apps use | one inline policy **added** to `morabu-dx-ec2-role`                                           |
| Editing the `dx.morabu.com` site beyond recognition                                            | one `include` line, with a backup in `/root`                                                  |
| Ports 3000 / 3100 already used                                                                 | `APP_PORT=3200`                                                                               |
| Assets 404 under `/telesales-dx/`                                                              | `VITE_BASE_PATH=/telesales-dx/` at build time, and nginx strips the prefix (`proxy_pass …/;`) |
| Secure session cookies dropped behind nginx                                                    | `TRUST_PROXY=true` and `X-Forwarded-Proto`                                                    |
| SES password with `/` or `+` breaking `SMTP_URL`                                               | URL-encoded with `enc` in step 7                                                              |
| `DATABASE_URL` pointing at `127.0.0.1` — inside the container that is the app itself           | host `db`                                                                                     |
| base64 database password — `/ + =` break `DATABASE_URL`                                        | `openssl rand -hex 24`                                                                        |
| Migrations forgotten after a deploy                                                            | the deploy workflow runs `prisma migrate deploy` every time                                   |
| Two deploys at once on a small server                                                          | `concurrency` in the workflow                                                                 |
| Scheduled notices sent twice                                                                   | `JOBS_ENABLED=true` on this one server only                                                   |
| Storage folder owned by root — the app runs as uid 1000                                        | `chown 1000:1000`                                                                             |
| Git set up for a normal user — SSM runs deploys as root without `HOME`                         | key under `/root`, `safe.directory` via `--system`                                            |
| Quoted values in `.env.production` — Docker keeps the quotes                                   | values without quotes                                                                         |
| Backup at the wrong hour on a UTC server                                                       | `30 18` UTC = 03:30 JST                                                                       |
| The area table file (real names) left on the server or put in Git                              | copied as text, loaded, then `shred -u`                                                       |
