# Requirements Document

## Project Description (Input)
喋りすぎる #18

ヨイさんの喋りがちょっと長すぎる。こっちの話もあまり聞いてくれない。

## Introduction

現状、AIファシリテーター「ヨイさん」の発話が長すぎて、参加者が話す隙を奪ってしまっている。飲み会ファシリテーションという性質上、AIはあくまで場を回す黒子であり、人間同士の会話を促進する存在でなければならない。本機能では、ヨイさんの1発話あたりの長さを抑え、参加者の発話に割り込まず耳を傾けるよう応答生成と介入頻度を調整する。ゴールは「ヨイさんが一言二言で軽やかに差し込み、主役は参加者」という体験を実現することである。

## Requirements

### Requirement 1: 応答長の抑制
**Objective:** As a 飲み会参加者, I want ヨイさんの1発話が短く簡潔であること, so that 自分たちの会話のテンポを壊されずに済む

#### Acceptance Criteria
1. When ヨイさんが応答を生成する, the Yo-i Facilitator shall 1発話を日本語でおよそ40文字以内（目安2文以内）に収める
2. When LLMへリクエストを送る, the Yo-i Facilitator shall 「短く・一言二言で・前置き禁止」という指示をシステムプロンプトに含める
3. When LLMへリクエストを送る, the Yo-i Facilitator shall `max_tokens` を短文に十分な値（上限 80 トークン程度）に設定する
4. If LLM応答が想定長（約40文字）を超える, then the Yo-i Facilitator shall 末尾を自然な文末で打ち切って出力する
5. The Yo-i Facilitator shall 箇条書き・長い解説・前置きの相槌（「なるほど〜それはですね〜」等）を生成しない

### Requirement 2: 聞き役としての振る舞い
**Objective:** As a 飲み会参加者, I want ヨイさんが自分の話をちゃんと聞いてから反応してくれること, so that 話している途中で遮られず気持ちよく話せる

#### Acceptance Criteria
1. While 参加者が発話中である, the Yo-i Facilitator shall 新たなAI応答の生成・再生を開始しない
2. When 参加者の発話が終わった, the Yo-i Facilitator shall 一定の無音（例: 1.5秒以上）を検知してから応答生成を開始する
3. When 直前のAI応答から十分な時間が経過していない, the Yo-i Facilitator shall 追加のAI応答を抑制する（クールダウンを設ける）
4. If 参加者同士の会話が弾んでいる（発話が連続している）, then the Yo-i Facilitator shall 介入を見送り沈黙キラー等の自動介入を発火させない
5. While AI音声を再生中である, the Yo-i Facilitator shall ユーザー発話を優先し、新しい発話を検知したら次の生成を待機させる

### Requirement 3: 介入頻度のコントロール
**Objective:** As a 飲み会参加者, I want ヨイさんが喋りすぎないよう適切な頻度で介入すること, so that AIが主役にならず人間同士の会話が中心であり続ける

#### Acceptance Criteria
1. The Yo-i Facilitator shall 直近の一定時間（例: 30秒）にヨイさんが発話した回数を上限（例: 1回）に制限する
2. When 沈黙キラーや乾杯などの自動介入条件が成立した, the Yo-i Facilitator shall クールダウン中であれば発火をスキップする
3. Where 参加者の発話量がバランスよく保たれている, the Yo-i Facilitator shall 自動介入の発火閾値を引き上げヨイさんの発言を控えめにする
4. If 連続して短時間にAI応答が生成されそうになる, then the Yo-i Facilitator shall 後続の応答生成要求をキャンセルまたはマージする

### Requirement 4: チューニング可能性と観測性
**Objective:** As a 開発者, I want 応答長・クールダウン・介入頻度の閾値を調整できること, so that 体験のチューニングを素早く反復できる

#### Acceptance Criteria
1. The Yo-i Facilitator shall 応答長の上限・クールダウン秒数・無音検知秒数を1箇所で定義された定数または設定値として保持する
2. When 設定値を変更する, the Yo-i Facilitator shall コード変更のみで再デプロイ可能な状態を維持する（環境変数化は必須としない）
3. The Yo-i Facilitator shall AI応答が生成・抑制されたタイミングとその理由（クールダウン・発話中・閾値超過等）をサーバーログに出力する
4. If AI応答が設定上限を超えて切り詰められた, then the Yo-i Facilitator shall 切り詰めが発生した旨をログに残す
