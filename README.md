# テレマ・営業DX (telesales-dx)

テレマと営業の業務をつなぐ社内Webアプリです。ログイン後、DBに登録された役割（テレマ／リーダー／営業／閲覧／管理者。1人に複数可）に応じて、使える機能が変わります。

Internal web app connecting telemarketing and sales. After login, what each user can do depends on the roles stored in the database (TELEMA / TELEMA_LEAD / SALES / VIEWER / ADMIN; one user can hold several).

## 構成 / Structure

```
apps/
  api/      Express 5 + Prisma 7 (PostgreSQL) — 認証・API
  web/      React 19 + Vite + Tailwind CSS 4 — 画面
packages/
  shared/   API と画面で共有する型・スキーマ・定数
docs/       設計メモ
```

詳細は [docs/architecture.md](docs/architecture.md) を参照してください。

## 必要なもの / Requirements

- Node.js 22 LTS 以上（`.nvmrc`）
- pnpm 11（`corepack enable` で有効化）
- PostgreSQL 16（ローカル、または `docker compose up -d db`）

## セットアップ / Setup

```bash
corepack enable
pnpm install

# API の環境変数
cp apps/api/.env.example apps/api/.env
# SESSION_SECRET を変更: openssl rand -base64 48

# DB のマイグレーション
pnpm db:migrate

# 最初の管理者を作成（仮パスワードが1回だけ表示されます）
pnpm user:create --email you@example.co.jp --name "山田 太郎" --roles ADMIN
```

## 開発 / Development

```bash
pnpm dev          # API http://localhost:3000 + 画面 http://localhost:5173
pnpm test         # 全パッケージのテスト
pnpm lint         # ESLint
pnpm typecheck    # TypeScript
pnpm build        # 本番ビルド
```

ユーザー作成の例 / Creating users:

```bash
pnpm user:create --email a@example.co.jp --name "佐藤 花子" --employee-no 1234 --roles TELEMA,TELEMA_LEAD
pnpm user:create --email b@example.co.jp --name "中村 一郎" --roles SALES
pnpm user:create --email c@example.co.jp --name "DX 太郎" --roles VIEWER
```

初回ログイン時はパスワードの変更が必須です。 / Users must change the temporary password at first login.

## 本番 / Production

```bash
pnpm build
pnpm db:deploy
WEB_DIST_DIR=$(pwd)/apps/web/dist NODE_ENV=production TRUST_PROXY=true pnpm start
```

API が画面（`apps/web/dist`）も配信するため、1つのオリジンで動きます。HTTPS は nginx や ALB で終端してください。既存サイトのパスの下（例 `/telesales-dx/`）で動かすときは、ビルド時に `VITE_BASE_PATH=/telesales-dx/` を指定します。

The API also serves the built web app, so everything runs on one origin. Terminate HTTPS at nginx or a load balancer. To serve it under a path of an existing site (e.g. `/telesales-dx/`), build with `VITE_BASE_PATH=/telesales-dx/`.

### 会社のAWSへのデプロイ / Company AWS deployment

- 手順書 / Runbook: [docs/DEPLOY-COMPANY-AWS.md](docs/DEPLOY-COMPANY-AWS.md)
- `Dockerfile` + `docker-compose.prod.yml`: アプリと PostgreSQL をサーバー1台で動かす / the app and PostgreSQL on one server
- `.github/workflows/ci.yml`: プルリクエストごとに lint・型・テスト・ビルド / every pull request is checked
- `.github/workflows/deploy.yml`: `main` にマージすると自動で本番に反映（OIDC + SSM、アクセスキーは保存しない） / every merge into `main` is deployed automatically

営業担当表の読み込み / Loading the sales area table: `pnpm --filter @telesales/api run area:import --file <xlsx> --dry-run`（手順書のステップ13）
