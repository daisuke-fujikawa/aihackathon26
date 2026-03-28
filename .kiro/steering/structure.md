# Project Structure

## Organization Philosophy

Next.js App Routerの規約に従った機能ベース構成。`src/` ディレクトリをルートとし、ページ・API・共有ロジック・データベースを明確に分離。

## Directory Patterns

### Pages & Layouts
**Location**: `src/app/`
**Purpose**: ルーティング、ページコンポーネント、レイアウト
**Convention**: Next.js App Router規約（`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`）

### API Routes
**Location**: `src/app/api/[endpoint]/route.ts`
**Purpose**: バックエンドAPI（Route Handlers）
**Convention**: 機能名のディレクトリに `route.ts` を配置。POST/GET等をnamed exportで定義。

### Database Layer
**Location**: `src/db/`
**Purpose**: DB接続とスキーマ定義
**Pattern**:
- `index.ts` — DB接続インスタンスのエクスポート（`db`）
- `schema.ts` — Drizzle ORMスキーマ定義（全テーブル）

### Shared Libraries
**Location**: `src/lib/`
**Purpose**: 外部サービスクライアント、ユーティリティ
**Pattern**: サービスごとに1ファイル（例: `ai.ts` でAnthropicクライアント）

## Naming Conventions

- **Files**: kebab-case（`route.ts`, `schema.ts`）
- **Components**: PascalCase（`RootLayout`）
- **Variables/Functions**: camelCase（`geistSans`, `anthropic`）
- **DB Tables**: snake_case（`created_at`）
- **DB Schema exports**: camelCase（`posts`）

## Import Organization

```typescript
// 1. External packages
import { neon } from "@neondatabase/serverless";
// 2. Internal absolute imports
import { anthropic } from "@/lib/ai";
// 3. Relative imports
import "./globals.css";
```

**Path Aliases**:
- `@/` → `src/`

## Code Organization Principles

- Server Componentsをデフォルトとし、`'use client'` は必要最小限に
- DB操作はServer Components/Route Handlersからのみ実行
- 外部サービスクライアントは `src/lib/` で一元管理しシングルトンとしてエクスポート

---
_created_at: 2026-03-28_
