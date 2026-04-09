# Implementation Plan

本実装計画は、モバイル（iOS Safari / Android Chrome）でヨイさんの TTS が再生されない最優先課題を解消し、併せてレスポンシブレイアウト・プラットフォーム検知・エラー通知を整備する。タスクは `design.md` の境界に沿って、Hook 層 → UI 統合 → 検証の順に進行する。

- [x] 1. プラットフォーム検知基盤を追加する
- [x] 1.1 (P) プラットフォーム検知 Hook を実装する
  - iOS Safari / Android Chrome / デスクトップを UA から分類し、`isMobile` を判定する
  - `window.AudioContext` の有無と `webkitSpeechRecognition` の有無で Web Audio / Web Speech サポートを判定する
  - SSR 安全性を保ち、マウント前はデフォルト値（デスクトップ・全機能サポート扱い）を返す
  - `requiresUserGestureUnlock` は iOS / Android いずれかで true とする
  - _Requirements: 2.2, 5.1, 5.2_

- [x] 2. オーディオ再生 Hook にモバイル unlock とエラー状態を追加する
- [x] 2.1 AudioContext の unlock API を追加する
  - ユーザージェスチャー同期文脈で `AudioContext` を生成・`resume()` し、無音 1 サンプルバッファを再生してロック解除する
  - 2 回目以降の unlock 呼び出しを冪等に扱う
  - unlock 成否を discriminated union で返し、失敗理由（未サポート / resume 拒否 / unknown）を区別する
  - unlock 済み状態を内部ステートに保持し、UI が参照できるように公開する
  - _Requirements: 1.1, 1.3_

- [x] 2.2 既存の再生ロジックを unlock 済み context 前提に書き換える
  - `playAudio` での遅延 `AudioContext` 生成を廃止し、unlock 済みインスタンスを再利用する
  - `suspended` 状態を検出したときのみ `resume()` を追加で試みる
  - 再生前に前回の `AudioBufferSourceNode` を確実に停止・解放する
  - TTS 発話中は既存のマイクミュート連携を維持する
  - _Requirements: 1.2, 2.3, 2.4, 4.2_

- [x] 2.3 再生エラーと自動リカバリ状態を公開する
  - `decodeAudioData` 失敗・`start()` 例外・context suspended を discriminated union で state に反映する
  - 初回失敗時に 1 度だけ `AudioContext` を再生成して再試行する
  - iOS silent switch 可能性の検知（再生 progress 停滞）をベストエフォートで実施し、状態に反映する
  - `clearError` を提供し UI から明示的にリセットできるようにする
  - _Requirements: 1.4, 1.5, 1.6_

- [x] 3. 音声認識 Hook にモバイルライフサイクル対応を追加する
- [x] 3.1 visibility 復帰時のマイク再取得を実装する
  - `visibilitychange` を監視し、`visible` 復帰時に desired listening 状態であればマイクを再開する
  - 再開失敗時は最大 3 回リトライし、失敗確定時は `mobile-recovery-failed` エラーを立てる
  - 既存 API（`startListening`/`stopListening`）のシグネチャを破壊しない
  - `isSupported` フラグを戻り値に含め、UI の縮退モード判定に使えるようにする
  - _Requirements: 2.1, 2.2, 2.5, 4.4_

- [x] 4. モバイル向け UI バナーを新設する
- [x] 4.1 (P) 初回ガイダンスとエラーバナーを実装する
  - モバイル検知時にのみ「画面をタップで音声を有効化」ガイドを 1 行で表示する
  - 再生エラー > マイクエラー > ガイダンスの優先度で 1 バナーだけ表示する
  - 再試行ボタンを配置し、親コンポーネントへ再試行リクエストを通知する
  - Web Audio / Web Speech 未サポート時の縮退メッセージを表示する
  - _Requirements: 1.3, 1.5, 2.2, 5.1, 5.2, 5.3_

- [x] 5. SetupScreen をユーザージェスチャー unlock 起点にする
- [x] 5.1 開始タップで AudioContext を unlock する
  - 「飲み会を開始する」ボタンの同期ハンドラ内で unlock を呼び出す
  - unlock 失敗時はバナーへエラーを通知し、再タップで再試行できるようにする
  - プラットフォーム検知結果に応じてモバイル向けガイダンス文言を表示する
  - CTA・追加ボタン等の主要タップターゲットを最低 44px に調整する
  - _Requirements: 1.1, 1.3, 3.3, 5.1_

- [x] 6. メイン画面レイアウトをモバイル対応にする
- [x] 6.1 dvh とセーフエリアに追従するレイアウトへ置換する
  - ルート要素の高さを dynamic viewport 単位に置換し、iOS アドレスバー変動ではみ出さないようにする
  - ヘッダー・フッターに `env(safe-area-inset-*)` 相当の余白を適用する
  - 画面回転時にも要素が画面外に出ないようフレックスレイアウトを調整する
  - _Requirements: 3.4, 3.5, 3.6_

- [x] 6.2 モバイル 1 カラム構成とタップターゲットを整える
  - <768px で 1 カラムに切り替え、ヨイさんアイコン・ビールジョッキ・操作ボタンを縦方向に整列する
  - 320〜430px 幅で横スクロールが発生しないことを担保する
  - マイクトグル等の主要ボタンのヒット領域を 44x44px 以上確保する
  - ビールジョッキビジュアライザを親要素幅に追従させ、狭幅でも崩れないようにする
  - _Requirements: 3.1, 3.2, 3.3, 4.1_

- [x] 7. モバイル検知・エラー状態をメインオーケストレーションに統合する
- [x] 7.1 YoiAppInner にプラットフォーム Hook とバナーを結線する
  - `usePlatformCapabilities` の結果を取得し、バナーと設定画面に伝搬する
  - `useAudioPlayer` の再生エラー・`useSpeechRecognition` のエラーをバナー props に橋渡しする
  - 再試行アクションを `clearError` や `playAudio` 再呼び出しと接続する
  - 既存の fetchWithRetry 経由の TTS/Chat 呼び出し失敗を UI で可視化する
  - _Requirements: 1.5, 2.2, 4.3, 5.3_

- [x] 8. テストとデバッグ可観測性を整える
- [x] 8.1 Hook の単体テストを追加する
  - unlock がユーザージェスチャー後に running 状態になることを検証する
  - playAudio 失敗時に PlaybackError が state に反映されることを検証する
  - visibility 復帰時の再起動リトライが最大 3 回で打ち切られることを検証する
  - プラットフォーム検知が iOS Safari / Android Chrome / デスクトップの UA を正しく分類することを検証する
  - _Requirements: 1.1, 1.5, 1.6, 2.2, 2.5_

- [ ] 8.2* UI バナーとレイアウトのレンダリングテストを追加する
  - バナーの優先度（playback error > speech error > guidance）が守られることを検証する
  - モバイル幅でルートレイアウトが dvh ベースで描画されることをスナップショットで確認する
  - _Requirements: 3.1, 3.2, 5.1, 5.2_

- [x] 8.3 デバッグログとデベロッパーフィードバックを追加する
  - 開発環境のみ `AudioContext.state`・unlock 成否・visibility recovery 回数を `console.debug` に出力する
  - 本番環境ではログを抑制し個人情報を含めないことを担保する
  - _Requirements: 5.4_
