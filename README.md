# くらしの家計簿

ブラウザにデータを保存する家計簿Webアプリの試作です。収入・支出の登録、月別一覧、支出済み・予定額を確認できます。

## 開発環境

Node.jsとnpmを用意し、このフォルダで次を実行します。Windows PowerShellで `npm` が実行制限により使えない場合は `npm.cmd` を使用します。

```sh
npm install
npm run dev
```

ターミナルに表示されるローカルURLをブラウザで開きます。終了は `Ctrl+C`。ビルド確認は `npm run build` です。

データは使用したブラウザ内に保存され、別端末に自動同期されません。ブラウザのデータを消去すると記録も消える可能性があります。試作のため、大切なデータの保存には使用しないでください。

Excel連携、予算、定期収支、編集・削除などは未実装です。[仕様書](kakeibo_spec.md)と[技術選定メモ](technology_selection.md)も参照してください。過去の `Kakeibo` と `Kakeibo.xcodeproj` はWeb化前のiOS試作です。
