# Requirements Document

## Project Description (Input)
#19 スマホ対応

現状、デスクトップのChromeでは「ヨイさん」が音声で応答するが、スマートフォン（iOS Safari / Android Chrome）ではヨイさんが喋らない、あるいはUIが崩れて操作できないという課題がある。モバイルブラウザのオートプレイポリシー、Web Speech API / Web Audio APIの挙動差、タッチ操作、画面サイズへの追従を含めた「スマホ対応」を実現する。

## Introduction

本スペックは、AI幹事「ヨイさん」アプリをスマートフォン（iOS Safari / Android Chrome）で実用的に利用可能にすることを目的とする。特にユーザーから報告されている「スマホでヨイさんがしゃべってくれない」という事象（モバイルブラウザの自動再生制限によりTTS音声が出ない問題）を解消することを最優先とし、あわせて音声認識の安定動作、縦長画面に適したレスポンシブUI、タッチ操作性、マイクとスピーカーの両立など、モバイル体験全般の品質を底上げする。

対象端末はiOS 17以上のSafari、最新のAndroid Chromeとする。対象外はモバイルIE/古いAndroid WebView。

## Requirements

### Requirement 1: モバイルブラウザでのTTS音声再生
**Objective:** 飲み会参加者として、スマートフォンで利用したときにもヨイさんのTTS音声が確実にスピーカーから聞こえてほしい。そうすることで、デスクトップと同等のファシリテーション体験が得られる。

#### Acceptance Criteria
1. When ユーザーがスマートフォン上でセッション開始ボタンなどの最初のタップ操作を行ったとき, the Yo-i Facilitator shall そのユーザージェスチャーと同一コールスタック内で `AudioContext` を生成またはresumeし、モバイルブラウザの自動再生制限を解除する。
2. When ヨイさんの応答TTS音声がサーバーから到着したとき, the Yo-i Facilitator shall 事前にunlock済みの `AudioContext` 上で音声をデコード・再生し、iOS Safari / Android Chromeのスピーカーから可聴音量で出力する。
3. If `AudioContext` の状態が `suspended` のまま再生要求が発生したとき, then the Yo-i Facilitator shall 再生前に `resume()` を待機してから再生を開始し、`resume` が拒否された場合はユーザーに「画面をタップして音声を有効にしてください」と可視のガイドを表示する。
4. While iOS Safariで利用されている状態, the Yo-i Facilitator shall サイレントスイッチやミュート状態が有効でも可能な限り音声を再生できるよう、メディア種別として再生用途に適した構成でオーディオを出力する。
5. If スマートフォンで音声再生に失敗したとき, then the Yo-i Facilitator shall 失敗したことをUI上でユーザーに通知し、再試行のためのタップ可能なアクションを提示する。
6. The Yo-i Facilitator shall TTS再生機能がモバイルで動作しているか否かを検知し、初回失敗時に限り自動的に1回だけリカバリ（`AudioContext` 再生成＋resume）を試みる。

### Requirement 2: モバイルブラウザでの音声認識とマイク制御
**Objective:** 飲み会参加者として、スマホのマイクで自分や周囲の発話を拾ってほしい。そうすることで、発話量可視化やパス出しといったコア機能をスマホでも利用できる。

#### Acceptance Criteria
1. When ユーザーがスマートフォンでセッションを開始したとき, the Yo-i Facilitator shall `navigator.mediaDevices.getUserMedia` を通じてマイク権限をリクエストし、HTTPS配信下で権限取得に成功する。
2. If モバイルブラウザがWeb Speech API（`SpeechRecognition`）をサポートしていないとき, then the Yo-i Facilitator shall 未対応である旨をUIで明示し、音声認識に依存しない縮退モード（ボタン操作でヨイさんに話しかける）で継続利用できるようにする。
3. While ヨイさんがTTSで発話している間, the Yo-i Facilitator shall 自マイク入力をミュートまたは認識停止状態とし、スピーカー音をマイクが拾うことによる自己ループを防止する。
4. When TTS再生が完了したとき, the Yo-i Facilitator shall マイク入力/音声認識を自動的に再開する。
5. If ブラウザのバックグラウンド遷移や画面ロックによりマイクストリームが失われたとき, then the Yo-i Facilitator shall 状態を検知してUIで通知し、フォアグラウンド復帰時に再取得を試みる。

### Requirement 3: レスポンシブレイアウトとタッチ操作
**Objective:** 飲み会参加者として、縦持ちスマホでもヨイさんのUIが崩れず、指で操作できるようにしてほしい。そうすることで、片手でスマホを持ちながら自然に利用できる。

#### Acceptance Criteria
1. The Yo-i Facilitator shall 320px〜430px幅の縦向きビューポートで主要画面（セットアップ、メインセッション、ビールジョッキビジュアライザ）を横スクロールなしで表示する。
2. When 画面サイズがモバイルブレークポイント（例: <768px）以下のとき, the Yo-i Facilitator shall レイアウトを1カラム構成に切り替え、ビールジョッキ等の主要ビジュアルとヨイさんアイコン、操作ボタンを縦方向に整列させる。
3. The Yo-i Facilitator shall すべての主要タップターゲット（開始/停止/乾杯/設定ボタン等）を最小44×44 CSSピクセル以上のヒット領域で提供する。
4. When 端末が縦向きから横向きに回転したとき, the Yo-i Facilitator shall レイアウトを再計算し、要素が画面外にはみ出さないように追従する。
5. The Yo-i Facilitator shall モバイルSafariのアドレスバー高さ変動に対応するため、`100vh` ではなくビューポート単位（`svh`/`dvh` 等）または同等の手段でレイアウト高さを決定する。
6. Where iOSのSafe Area（ノッチ/ホームバー）が存在する端末, the Yo-i Facilitator shall `env(safe-area-inset-*)` を用いて操作要素が安全領域内に収まるようにする。

### Requirement 4: モバイル向けパフォーマンスと安定性
**Objective:** 飲み会参加者として、モバイル回線・低スペック端末でもアプリが固まらず、長時間の飲み会中に使い続けられるようにしてほしい。

#### Acceptance Criteria
1. The Yo-i Facilitator shall モバイル端末においてビールジョッキアニメーションを30fps以上で描画し、明らかなカクつきを発生させない。
2. While セッションが継続している間, the Yo-i Facilitator shall バッテリー消費やメモリ消費が無制限に増加しないよう、使用済みの `AudioBufferSourceNode` とイベントリスナを適切に解放する。
3. If モバイル回線が不安定でTTS/LLM APIリクエストが失敗したとき, then the Yo-i Facilitator shall エラーを握り潰さずにユーザーに状態を示し、リトライ可能にする。
4. When 端末画面がロックされ再度アクティブになったとき, the Yo-i Facilitator shall セッション状態（進行中/一時停止）を保持し、利用を再開できるようにする。

### Requirement 5: モバイル対応状況の可視化とフォールバック
**Objective:** 開発者・ユーザーとして、どの端末で何が使えるのかを明確に知りたい。そうすることで、サポート外の端末でも無言でフリーズするのではなく、納得して別手段を選べる。

#### Acceptance Criteria
1. When ユーザーが初めてアプリを開いたとき, the Yo-i Facilitator shall 実行中の環境（iOS Safari / Android Chrome / デスクトップ）を検知し、必要に応じてモバイル向けの初回ガイダンス（タップで音声を有効化する旨）を表示する。
2. If 実行中のブラウザがWeb Audio APIまたはWeb Speech APIを欠くとき, then the Yo-i Facilitator shall 該当機能を無効化する旨をユーザーに明示し、利用できる機能の範囲を提示する。
3. The Yo-i Facilitator shall モバイルで発生した音声関連エラーをコンソールだけでなくUI上のエラーバナーとして表示し、飲み会の場でも気付けるようにする。
4. Where 開発/QA環境で利用されている場合, the Yo-i Facilitator shall デバッグ用に `AudioContext.state` やunlock成否をコンソールに出力し、後から挙動を追跡できるようにする。
