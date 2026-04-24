# キャンプ飯プランナー

2泊3日のキャンプ飯を朝昼晩に割り当て、買い物リストと概算予算を自動集計する静的Webアプリです。

## 機能

- レシピを食事枠に割り当て
- 人数変更
- 材料をカテゴリ別に自動合算
- 概算予算の自動集計
- レシピタグで絞り込み
- 選択状態をURLで共有
- GitHub Pagesにデプロイ可能

## ローカル実行

```bash
npm install
npm run dev
```

## GitHub Pages

`.github/workflows/deploy.yml` が入っています。

GitHub側で以下を設定してください。

1. Repository Settings
2. Pages
3. Source を `GitHub Actions` に変更
4. main branchへpush

## レシピ追加

`src/recipes.json` にレシピを追加します。

材料は `itemId` と `unit` が同じものだけ合算します。
