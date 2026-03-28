# Research & Design Decisions

## Summary
- **Feature**: ai-communication-beer (Yo-i Facilitator)
- **Discovery Scope**: New Feature (greenfield)
- **Key Findings**:
  - Web Speech APIは話者識別（ダイアリゼーション）非対応。参加者個別のトラッキングは名前入力ベースで簡略化が必要
  - OpenAI TTS APIのspeedパラメータ（0.25-4.0）とWeb Audio APIのplaybackRate組み合わせで酔っ払い音声効果を実現可能
  - canvas-confettiは6KB gzippedで軽量、即座にインポート・呼び出し可能

## Research Log

### Web Speech API（音声認識）
- **Context**: Requirement 1（リアルタイム音声認識）の技術選定
- **Sources**: MDN Web Docs, Chrome Platform Status
- **Findings**:
  - `webkitSpeechRecognition`プレフィックスがChromeでは依然必要
  - `continuous: true` + `interimResults: true`でリアルタイム認識
  - 約60秒の無音でセッション自動切断、約5分の連続使用で切断の可能性
  - `onend`イベントで自動再接続ロジック必要（100-300msの遅延挿入）
  - HTTPS必須（Vercelデプロイで自動対応、localhostはHTTP可）
  - **話者識別は不可能** — 全音声が単一の未分化テキストとして返される
  - 音声レベルデータなし — 発話量計測にはAudioContext + AnalyserNodeが別途必要
- **Implications**:
  - 「未発話者へのパス出し」（Req 3）は参加者を事前登録し、手動で発話割り当てするか、全体の沈黙検出に簡略化
  - ビールジョッキUI（Req 2）の発話量は全体音量ベースで実装

### 話者識別の制約と設計判断
- **Context**: Requirement 3（未発話者パス出し）には個別参加者の発話追跡が必要
- **Findings**:
  - Web Speech APIは話者区別不可
  - サーバーサイドのダイアリゼーション（Google Cloud Speech等）は複雑すぎてハッカソン向きでない
  - 代替案: 参加者名を事前入力し、AIが文脈からランダムに指名する簡易方式
- **Implications**: パス出しは「特定の未発話者」ではなく「参加者リストからランダム指名」で実装

### OpenAI TTS API
- **Context**: Requirement 9（音声合成）の技術選定
- **Sources**: OpenAI API Reference
- **Findings**:
  - `POST /v1/audio/speech` — model: `tts-1`（低遅延）, voice: 6種、speed: 0.25-4.0
  - 最大入力: 4096文字/リクエスト
  - レスポンス: 音声バイナリ（mp3, opus, wav等）
  - tts-1の初回バイト到達: 約300-500ms
  - 料金: $15/1M文字（tts-1）
- **Implications**: speed 0.7-0.85で酔っ払い風に。3秒以内のレスポンス目標は達成可能

### Web Audio APIエフェクト
- **Context**: 酔っ払い音声効果の実現方法
- **Findings**:
  - `AudioBufferSourceNode.playbackRate`でピッチと速度が連動して変化
  - 独立したピッチ制御にはTone.js等が必要だが、0.9-1.1の範囲なら微妙な揺らぎで自然
  - `ConvolverNode`でリバーブ追加可能（インパルスレスポンスファイル必要）
  - シンプルな効果チェーン: Source → BiquadFilter → Gain → Destination
- **Implications**: ハッカソン向けにはplaybackRateのランダム揺らぎ（0.9-1.05）で十分。リバーブは追加工数が大きいためスコープ外

### canvas-confetti
- **Context**: Requirement 5（乾杯演出）の技術選定
- **Findings**:
  - npm: `canvas-confetti` v1.9.3、6KB gzipped
  - `confetti({ particleCount, spread, origin, colors })` でワンコール実行
  - Promiseベース、自動クリーンアップ
  - React統合: インポートして直接呼び出すだけ
- **Implications**: 追加の抽象化不要、直接呼び出し

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| クライアント中心型 | 音声認識・状態管理・UIをクライアントに集中、サーバーはAPI呼び出しのプロキシのみ | シンプル、低遅延、リアルタイム性が高い | クライアントの複雑化 | ハッカソン向きの簡潔さ |
| サーバー中心型 | 音声データをサーバーに送信して処理 | セキュリティ、サーバーサイドロジック集中 | 遅延増大、WebSocket必要 | 過剰設計 |

**選択**: クライアント中心型 — Web Speech APIがブラウザネイティブのため

## Design Decisions

### Decision: 話者識別の簡略化
- **Context**: Web Speech APIは話者区別不可だが、Req 3は個別参加者へのパス出しを要求
- **Alternatives**:
  1. サーバーサイドダイアリゼーション — 複雑すぎ
  2. 参加者名リスト + ランダム指名 — シンプル
- **Selected**: 参加者名リスト方式。開始時に参加者名を入力し、AIがランダムに選んで指名
- **Rationale**: ハッカソン時間制約内で実現可能かつデモ効果あり
- **Trade-offs**: 実際の発話状況に基づく指名ではないが、飲み会の雰囲気には十分

### Decision: TTS音声エフェクト方式
- **Context**: 酔っ払い風音声の実現
- **Alternatives**:
  1. OpenAI TTS speed低下のみ — シンプルだが一定
  2. speed低下 + playbackRate揺らぎ — 自然な酔っ払い感
  3. Tone.js + 独立ピッチシフト — 最高品質だが複雑
- **Selected**: Option 2。TTS speed: 0.8 + playbackRate: 0.95-1.05のランダム揺らぎ
- **Rationale**: 最小実装で十分な効果

### Decision: 発話量計測方式
- **Context**: ビールジョッキUI（Req 2）の発話量データ取得
- **Selected**: AudioContext + AnalyserNodeで音量レベルを取得し、発話時間を累積計算
- **Rationale**: Web Speech APIは音量データを提供しないため、並行してAudioContextを使用

## Risks & Mitigations
- Web Speech APIセッション切断 → onendイベントで自動再接続（100-300ms遅延）
- OpenAI TTS API遅延 → tts-1モデル使用（300-500ms）、テキスト短縮で対応
- マイク権限拒否 → 明確なエラーメッセージとリトライUI
- 居酒屋の騒音環境 → Web Speech APIの認識精度低下リスク（軽減策なし、デモ環境で対応）

## References
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [OpenAI TTS API Reference](https://platform.openai.com/docs/api-reference/audio/createSpeech)
- [canvas-confetti npm](https://www.npmjs.com/package/canvas-confetti)
- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
