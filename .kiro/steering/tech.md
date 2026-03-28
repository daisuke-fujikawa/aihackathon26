# Technology Stack

## Architecture

Next.js App Routerによるフルスタック構成。Server Componentsをデフォルトとし、音声入出力など対話的な部分のみClient Componentsを使用。APIはRoute Handlersで実装し、Vercelにデプロイ。

## Core Technologies

- **Language**: TypeScript (strict)
- **Framework**: Next.js 16 (App Router)
- **Runtime**: Node.js (Vercel Fluid Compute)
- **UI**: React 19 + Tailwind CSS v4
- **Font**: Geist Sans / Geist Mono

## Key Libraries

- **AI**: `@anthropic-ai/sdk` — Claude APIによる応答生成
- **DB**: `drizzle-orm` + `@neondatabase/serverless` — Neon PostgreSQLへのサーバーレス接続
- **音声認識**: Web Speech API（ブラウザ標準、追加ライブラリ不要）
- **音声合成**: OpenAI TTS API（要追加セットアップ）

## Development Standards

### Type Safety
- TypeScript strict mode
- 環境変数は `process.env.XXX!` で非null assertionを使用

### Code Quality
- ESLint（eslint-config-next）

### Testing
- 未導入（ハッカソン規模のため）

## Development Environment

### Required Tools
- Node.js 24 LTS
- npm

### Common Commands
```bash
# Dev: npm run dev
# Build: npm run build
# DB generate: npm run db:generate
# DB migrate: npm run db:migrate
# DB studio: npm run db:studio
```

## Key Technical Decisions

- **Anthropic SDK直接使用**: ハッカソン迅速性のためAI Gatewayではなく `@anthropic-ai/sdk` を直接使用
- **Neon HTTP driver**: サーバーレス環境に最適化されたHTTPベースのDB接続（WebSocket不要）
- **Drizzle ORM**: 型安全なスキーマ定義とマイグレーション管理
- **Web Speech API**: Chrome標準搭載で追加コスト・セットアップなしの音声認識

---
_created_at: 2026-03-28_
