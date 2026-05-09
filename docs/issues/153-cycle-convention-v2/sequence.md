# シーケンス設計

本 Issue はランタイム処理ではなく、**v1 規約から v2 規約への移行**を扱う。
sequence は **v2 サイクルの全体フロー**と **本 PR 自身の workflow 反映フロー**の 2 種類を記述。

## v2 開発サイクル全体フロー

```mermaid
sequenceDiagram
  autonumber
  actor User as ユーザー (人間)
  actor AI as Claude Code (AI)
  participant Issue as GitHub Issue
  participant PR as Pull Request
  participant CI as claude-review<br/>(Bot)

  Note over User,Issue: Phase 0
  User->>Issue: 要件 + 設計サマリー作成

  Note over AI,PR: Phase 1: 詳細設計
  AI->>Issue: gh issue view <NNN>
  AI->>AI: docs/issues/<NNN>-<slug>/ 立ち上げ<br/>(README, sequence, test-plan, review)
  AI->>AI: ブランチ <type>/<NNN>-<slug>
  AI->>PR: gh pr create --draft<br/>title="[Phase 1] <Issue title>"
  AI->>Issue: 設計サマリー逆書き戻し
  PR->>CI: trigger pull_request<br/>(Phase 1 専用 prompt で起動)
  CI-->>PR: 設計レビューコメント (要件・シーケンス・テスト計画に絞る)

  Note over User,PR: Phase 1.5: 設計レビュー対応
  alt 設計差し戻し
    User->>PR: コメントで指摘
    AI->>PR: docs(<NNN>): Phase 1 設計レビュー FB を反映
  else 設計承認
    User->>PR: PR コメント or タイトル変更で Phase 2 着手の合図
  end

  Note over AI,PR: Phase 2: 実装
  AI->>PR: feat(<NNN>) or fix(<NNN>): Phase 2 実装
  Note over PR: PR は Draft のまま<br/>(他 CI は draft なら走らない)

  Note over AI,PR: Phase 3: 検証
  AI->>AI: /verify-issue <NNN><br/>test-plan を順に消化
  AI->>PR: chore(<NNN>): Phase 3 検証エビデンス追加

  Note over AI,PR: Phase 4: Ready 切替 (自動)
  alt 全 PASS
    AI->>PR: gh pr edit --title <タイトルから [Phase 1] 削除>
    AI->>PR: gh pr ready <NNN>
    Note over PR: Draft → Ready<br/>他 CI 全部走る
  else 一部 fail / 保留
    AI->>PR: review.md に保留理由記録
    Note over PR: Draft 維持<br/>人間判断待ち
  end

  Note over User,PR: Phase 5: FB 集約とマージ
  User->>PR: 最終レビュー → approve
  AI->>PR: /wrap-issue <NNN><br/>review.md に集約・ナレッジ昇華
  User->>PR: Merge commit でマージ (Squash 不使用)
  Issue->>Issue: 自動クローズ (Fixes #<NNN>)
```

## 本 PR の workflow 反映フロー

本 Issue は workflow 変更を含むため、PR #152 と同様の cherry-pick 戦略を取る。
ただし PR #152 で発見した **タイミング差問題**を踏まえ、`main push → CI 反映待ち → PR push` の順序を明示する。

```mermaid
sequenceDiagram
  autonumber
  actor Dev as 開発者 (AI)
  participant PRBranch as PR ブランチ<br/>chore/153-...
  participant Main as main ブランチ
  participant CI as claude-code-action

  Note over Dev,PRBranch: Phase 1-3 で docs/skill のみ変更
  Dev->>PRBranch: docs(153) / skill 変更コミット
  Dev->>PRBranch: git push (workflow 未変更なので CI pass)

  Note over Dev,Main: Phase 2 で workflow 変更を含む場合のフロー

  rect rgba(255, 230, 230, 0.4)
    Note over Dev,CI: workflow 変更コミットの安全反映
    Dev->>PRBranch: workflow 変更コミット (PR ブランチに先に積む)

    alt main 直接 push が許可されている (推奨)
      Dev->>Main: cherry-pick (workflow 変更のみ)
      Dev->>Main: git push origin main
      Note over Main: ⏰ 数秒〜数十秒待つ<br/>(GitHub の workflow 認識反映待ち)
      Dev->>PRBranch: git push (CI が新 main を見て validation 通過)
    else permission denied
      Dev->>Main: 別 PR (chore/153-workflow-only) を先にマージ
      Dev->>PRBranch: git pull origin main
      Dev->>PRBranch: git push
    end
  end

  PRBranch->>CI: trigger pull_request
  CI-->>PRBranch: ✅ workflow validation pass
```

## 補足

### Phase 4 自動 Ready 切替の判定

`/verify-issue` の最終ステップで:

```bash
# test-plan.md 内の未チェック項目をカウント
unchecked=$(grep -c '^- \[ \]' docs/issues/<NNN>-<slug>/test-plan.md)

if [ "$unchecked" = "0" ]; then
  gh pr edit <PR> --title "$(echo "$title" | sed 's/\[Phase 1\] //')"
  gh pr ready <PR>
else
  echo "WARN: $unchecked 件未チェック。Draft 維持し review.md に保留理由を記録"
fi
```

### Bot 応答コミットメッセージのフォーマット

```
docs(<NNN>): Phase 1 設計レビュー FB を反映
feat(<NNN>): Phase 2 実装 - <概要>
fix(<NNN>): Phase 2 実装 - <概要>
chore(<NNN>): Phase 3 検証エビデンス追加
docs(<NNN>): Phase 5 review.md 集約
```

### マージ方式

- **Create a merge commit**: 標準。Phase 別 commit を main 履歴に残す
- **Rebase and merge**: 可。同様に Phase 別 commit が残る
- **Squash and merge**: 不使用。Phase 履歴が消える + cherry-pick との重複の原因
