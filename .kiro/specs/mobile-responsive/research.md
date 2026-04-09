# Research & Design Decisions — mobile-responsive

## Summary
- **Feature**: `mobile-responsive`
- **Discovery Scope**: Extension（既存のYo-i Facilitatorアプリへのモバイル対応拡張）
- **Key Findings**:
  - 現行 `useAudioPlayer` は `playAudio` 呼び出し時点で初めて `AudioContext` を生成するため、`ttsRes.arrayBuffer()` を await した後の非ユーザージェスチャー文脈で初期化されており、iOS Safari / Android Chrome のオートプレイ制限に抵触して無音になる。
  - iOS Safari は「サイレントスイッチON」「ミュートモード」時、純粋な Web Audio API のスピーカー出力も抑制されるため、`playsInline` 属性付き `<audio>` 要素経由や `AudioSession`（iOS 17+）/ サイレントモード回避手段の考慮が必要。
  - レイアウトは `h-screen`（`100vh`）を使用しており、iOS Safari のアドレスバー変動で要素がはみ出すため、`svh` / `dvh` もしくは `100dvh` への置換が必要。

## Research Log

### iOS/Android モバイルブラウザの自動再生制限
- **Context**: Requirement 1「スマホでヨイさんがしゃべらない」の根本原因調査。
- **Sources Consulted**:
  - MDN: Web Audio API best practices（AudioContext unlock pattern）
  - WebKit Blog: "Adding iOS Web Audio support" / Autoplay Policy
  - Chrome Developers: "Autoplay policy in Chrome"
- **Findings**:
  - `AudioContext` をユーザージェスチャー（`click`/`touchend`/`pointerdown`）コールスタック内で作成または `resume()` しない限り、`suspended` のまま留まり音が出ない。
  - 一度 unlock した `AudioContext` はそのタブのライフタイム中再利用でき、以後のプログラム的再生は許容される（ただしページ離脱や Bfcache 復帰で再度 suspended になり得る）。
  - iOS Safari の silent switch は純 WebAudio 出力をミュートするため、`HTMLAudioElement` 経由でデコード済み音声を再生するか、`AudioContext` の `latencyHint: 'playback'` と無音バッファ事前再生を組み合わせる必要がある。
- **Implications**:
  - `SetupScreen` の「飲み会を開始する」タップハンドラで `AudioContext` を同期生成＋無音バッファ再生による unlock を必ず実行する。
  - 以後 `useAudioPlayer.playAudio` は既存 context を再利用するだけにする（遅延生成をやめる）。
  - silent switch 回避は best effort とし、失敗検知時に UI ガイドで切替を促す。

### モバイル Viewport / レイアウト単位
- **Context**: Requirement 3 モバイル縦持ちでの UI 崩れ防止。
- **Sources Consulted**:
  - web.dev "The large, small, and dynamic viewport units" (`lvh`, `svh`, `dvh`)
  - Tailwind CSS v4 documentation: dynamic viewport utilities
- **Findings**:
  - iOS Safari で `100vh` を指定すると、アドレスバー分がはみ出して下部操作 UI が見切れる。
  - `100dvh` / `100svh` により正しい可視領域に追従可能。Tailwind v4 では `h-dvh` / `min-h-dvh` が利用可能。
  - ノッチ / ホームバーは `env(safe-area-inset-*)` を padding 側で吸収する。
- **Implications**:
  - `yoi-app.tsx` の `h-screen` を `h-dvh`（または同等のユーティリティ）へ置換し、フッターに `pb-[env(safe-area-inset-bottom)]` 相当を追加する。

### マイク / TTS の排他制御とバックグラウンド遷移
- **Context**: Requirement 2 / 4 のモバイル固有課題調査。
- **Sources Consulted**:
  - W3C Media Capture and Streams 仕様
  - Chromium Bug Tracker: background tab mic stream lifecycle
- **Findings**:
  - iOS Safari は画面ロック・タブ非アクティブで `MediaStream` を停止することがある。`visibilitychange` / `pagehide` の監視と、`visible` 復帰時の再取得が必要。
  - 既存コードは TTS 再生中に `stopListening()` を呼んでいるが、モバイルでは `onend` 後の自動再接続が禁止される場合があり、`startListening()` 復帰処理に失敗リトライを追加すべき。
- **Implications**:
  - 既存の `useSpeechRecognition` に `visibilitychange` ハンドラを追加する。`recoverOnVisible` オプションで挙動を制御。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Hook拡張（現状維持＋unlock責務追加） | `useAudioPlayer` に unlock API を追加し、`SetupScreen` から呼ばせる | 変更範囲小、既存 provider 構造を維持 | unlock 責務が UI に漏れる | 推奨 |
| 専用 AudioUnlockProvider 新設 | Context Provider でグローバル管理 | 呼び出し箇所が明示的 | 構造追加コスト、状態二重管理 | 将来検討 |
| HTMLAudioElement 全面移行 | Web Audio を廃止し `<audio>` ベースに | iOS silent switch 回避が容易 | 既存のフィルタ/揺らぎエフェクトが失われる | 却下（酔っ払いエフェクト喪失） |

## Design Decisions

### Decision: AudioContext の unlock は SetupScreen のタップハンドラで実行
- **Context**: iOS/Android の自動再生制限を解除するにはユーザージェスチャー同期文脈で `AudioContext` を生成＆ `resume()` する必要がある。
- **Alternatives Considered**:
  1. `useAudioPlayer` 内部で初回 `playAudio` 時に `resume` を試みる（現状）
  2. `SetupScreen` のタップで明示的に unlock する
- **Selected Approach**: `useAudioPlayer` に `unlock()` メソッドを公開し、`SetupScreen.handleSubmit` / 「飲み会を開始する」ボタンの `onClick` から同期的に呼び出す。無音 1 サンプルバッファを即時再生してロックを解除する。
- **Rationale**: iOS Safari は「ユーザー操作の同一コールスタック」でないと resume を受け付けない。fetch の await を挟む現状の実装は要件を満たせない。
- **Trade-offs**: UI 層が Audio の unlock 責務を持つが、呼び出しは1カ所に限定できるので影響は小さい。
- **Follow-up**: 実装後、iPhone 実機 Safari / Android Chrome で `AudioContext.state` が unlock 後 `running` になることを確認する。

### Decision: レイアウト高さ単位を `dvh` に統一
- **Context**: `h-screen` (`100vh`) のため iOS Safari でフッターが隠れる。
- **Selected Approach**: Tailwind v4 の `h-dvh` / `min-h-dvh` 系ユーティリティへ置換し、セーフエリア inset を追加。
- **Rationale**: 追加ライブラリ不要で、デスクトップでも等価の挙動となる。
- **Trade-offs**: 古いブラウザでは `dvh` が未サポートだが、対象端末（iOS 17+, 最新 Android Chrome）ではすべてサポート済。

### Decision: モバイル検知と初回ガイダンス表示
- **Context**: ユーザーが tap しないと音が出ない旨を明示する必要がある。
- **Selected Approach**: `SetupScreen` で `navigator.userAgent` ベースにモバイル判定し、モバイルのみ「ボタンをタップすると音声が有効になります」マイクロコピーを表示する。誤検知時にも実害はない。
- **Rationale**: デバイス検知はベストエフォートで十分。
- **Trade-offs**: UA スニッフィングは将来的に脆い点がある。

## Risks & Mitigations
- **Risk**: iOS Safari の silent switch が有効だと、unlock 成功しても無音になる。
  → **Mitigation**: 再生完了検知（`onended`）までに playback position が進まない場合を検出し、UI で「端末のサイレントモードを解除してください」バナーを表示する。
- **Risk**: `visibilitychange` 時にマイクストリームが失われ、復帰時再取得が失敗する。
  → **Mitigation**: 復帰リトライを最大3回、失敗時はユーザーに再タップを促すトーストを表示。
- **Risk**: `dvh` 変更が既存デスクトップ UI のレイアウトを崩す。
  → **Mitigation**: `h-dvh` は `vh` と同等挙動なのでデスクトップ影響は限定的。ビジュアルリグレッション確認を実施。

## References
- [MDN: Best practices for audio and video](https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide) — autoplay policy と unlock パターン
- [WebKit Blog: Autoplay Policy on iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/) — iOS Safari のユーザージェスチャー要件
- [web.dev: The large, small, and dynamic viewport units](https://web.dev/blog/viewport-units) — `svh`/`dvh` 解説
- [Tailwind CSS v4 Dynamic Viewport Heights](https://tailwindcss.com/docs/height) — `h-dvh` 等ユーティリティ
