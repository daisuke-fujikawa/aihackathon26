# Research & Design Decisions — concise-ai-response

## Summary
- **Feature**: `concise-ai-response`
- **Discovery Scope**: Extension（既存の音声対話パイプラインに対する振る舞い調整）
- **Key Findings**:
  - `src/app/api/chat/route.ts` は `max_tokens: 150` でシステムプロンプトに「1-2文程度」と指示しているが、実際には2-3文で冗長になりがち。後段で長さを担保する仕組みがない。
  - `useFacilitationEngine` は `isProcessing` 中のみ介入を抑制し、「直前に喋ったばかり」を理由に抑制するクールダウン機構が存在しない（沈黙キラー自身には `silenceThresholdSec * 1000` の自己クールダウンがあるだけ）。
  - クライアントの `yoi-app.tsx` は TTS 再生中 `stopListening()` で被りを防ぎつつ、発話の 1.5秒 デバウンスも実装済み。ただし「AI 再生中に受信したユーザー発話」の扱いやクールダウンが明示されていない。

## Research Log

### Topic 1: 現行の応答長制御
- **Context**: なぜヨイさんが長く喋るのか原因切り分け
- **Sources Consulted**: `src/app/api/chat/route.ts`, `src/lib/ai.ts`, コミット `977e416 Increase max_tokens from 100 to 150`
- **Findings**:
  - システムプロンプトでの長さ指示のみ。`max_tokens` は 150 と広め。
  - 応答テキストに対する後処理（切り詰め・正規化）はない。
  - Claude Sonnet 4 モデル使用。短文出力を安定させるには max_tokens とシステムプロンプト両方の強化が有効。
- **Implications**: サーバー側で (a) システムプロンプトの強制、(b) `max_tokens` 削減、(c) 応答テキストの後処理による安全弁、の3層で担保する。

### Topic 2: 介入頻度と「聞き役」挙動
- **Context**: ヨイさんが喋りすぎに感じるもう一因はターン頻度
- **Sources Consulted**: `src/hooks/use-facilitation-engine.ts`, `src/components/yoi-app.tsx`, `src/providers/session-state-provider.tsx`
- **Findings**:
  - デバウンス (1500ms) は `yoi-app.tsx` にハードコード済み。
  - `FacilitationConfig` には `silenceThresholdSec=30`, `passIntervalSec=60` などがあるが「直近 N 秒で AI が喋った回数」の上限はない。
  - ユーザー発話トリガーの応答と、自動介入（SILENCE_KILLER 等）が独立に走るため、連続発火のリスクがある。
- **Implications**: AI 発話共通のグローバルクールダウン（`aiCooldownSec`）を導入し、自動介入もユーザー応答もこれを尊重する。`yoi-app.tsx` 側の `generateAndSpeak` でクールダウンを一括チェックするのが最小改修。

### Topic 3: TTS 再生中のユーザー発話ハンドリング
- **Context**: 「こっちの話を聞いてくれない」体感の原因
- **Sources Consulted**: `src/components/yoi-app.tsx`, `src/hooks/use-audio-player.ts`, `src/hooks/use-speech-recognition.ts`
- **Findings**:
  - TTS 再生中は `stopListening()` で認識停止しているので割り込みはないが、直前直後の連続応答は発生しうる。
  - 現状、`isProcessingRef.current || isPlaying` が `useFacilitationEngine` に渡されており自動介入は抑制されるが、ユーザー発話トリガーはこれを見ていない（`generateAndSpeak` 先頭の `isProcessingRef.current` チェックのみ）。
- **Implications**: `generateAndSpeak` に「`isPlaying` / クールダウン / 最低 inter-response 間隔」を追加し、抑制理由をログに残す。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. サーバー側のみで対策 | プロンプト強化＋max_tokens削減＋切り詰め | 実装範囲が狭い | ターン頻度問題（喋りすぎ）が解消しない | 要件1のみ満たす |
| B. クライアント側のみで対策 | クールダウン、最低間隔、抑制 | フロントだけで完結 | 応答が依然長い場合がある | 要件2,3のみ |
| **C. サーバー＋クライアント両方** | 長さはサーバーで保証、頻度/聞き役はクライアントで制御 | 要件1-4すべてを最短で満たす、責務が明確 | 2箇所に変更が入る | **採用** |

## Design Decisions

### Decision: 応答長は「プロンプト＋max_tokens＋後処理」の三段で担保する
- **Context**: LLM の指示遵守だけでは不安定。ハッカソン品質で確実に短くしたい。
- **Alternatives Considered**:
  1. プロンプトのみ強化 — 失敗時のフォールバックがない
  2. 後処理のみ — 生成コスト・レイテンシが無駄
- **Selected Approach**: `YOI_SYSTEM_PROMPT` に「必ず1文。最大40字程度。前置き・相槌禁止」を追記。`max_tokens` を 150 → 80 に削減。応答テキストを `clampYoiResponse(text, maxChars)` で自然な文末（句点・！・？・〜）で切り詰めて返す。
- **Rationale**: 三段構成でどこか1つが崩れても安全弁が残る。レイテンシは max_tokens 削減で逆に改善。
- **Trade-offs**: 切り詰めによる表現の軽い不自然さ。ただし句読点ベースで自然さを担保。
- **Follow-up**: チューニング時に文字数上限を調整しやすいよう、定数は1箇所に集約。

### Decision: AI 発話のグローバルクールダウンを `generateAndSpeak` で一元管理する
- **Context**: ユーザー応答と自動介入が別経路だが、どちらも最終的に `generateAndSpeak` を通る。
- **Alternatives Considered**:
  1. 各トリガー発生箇所でクールダウンを判定 — 散在しバグ温床
  2. `useFacilitationEngine` 内で管理 — ユーザー応答経路を捕捉できない
- **Selected Approach**: `yoi-app.tsx` に `lastYoiSpeakAtRef` を追加。`generateAndSpeak` の先頭で「再生中 / クールダウン中 / 処理中」を判定して早期 return し、理由を `console.info` で記録する。
- **Rationale**: 全経路の合流点で一元制御でき、テストも容易。
- **Trade-offs**: 沈黙キラー等の重要介入までスキップされる可能性があるが、クールダウンは短め（デフォルト15秒）に設定することで実害を抑える。
- **Follow-up**: 実運用でクールダウン秒数を調整。

### Decision: 長さ・間隔の設定値は `FacilitationConfig` に集約する
- **Context**: 要件4でチューニング容易性が求められる。既に `FacilitationConfig` が設定ハブになっている。
- **Selected Approach**: `FacilitationConfig` に `maxResponseChars`, `aiCooldownSec`, `transcriptDebounceMs` を追加し、デフォルト値を1箇所で管理。
- **Trade-offs**: Provider の型が広がるが、SSoT（Single Source of Truth）が維持される。

## Risks & Mitigations
- **切り詰め後の不自然な文末** → 句読点/感嘆符/疑問符で打ち切る簡易ロジック、無ければ「…」を付与。
- **クールダウンにより沈黙キラーが無反応に見える** → デフォルト15秒と短めに設定、`silenceThresholdSec=30` と整合させる。
- **既存テストへの影響** → `src/app/api/chat/__tests__/route.test.ts` の期待値を新しい `max_tokens` とシステムプロンプト更新に合わせて調整。

## References
- Anthropic Messages API（`max_tokens` と応答長制御）: https://docs.anthropic.com/en/api/messages
- 既存コード: `src/app/api/chat/route.ts`, `src/hooks/use-facilitation-engine.ts`, `src/components/yoi-app.tsx`, `src/providers/session-state-provider.tsx`
