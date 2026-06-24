# リファレンス実装を業務プロセス可視化専用ビューアとして作り直す

Status: open
Model: GPT-5
Created: 2026-06-25
Updated: 2026-06-25
Branch: feat/8-process-viewer
Source:

- https://github.com/f4ah6o/responsible/issues/8

## 概要

現在のリファレンス実装を前提にせず、Activity と Lane を中心にした業務プロセス可視化専用の node-based viewer として作り直す。
Responsible の概念全体を説明する汎用 UI ではなく、業務プロセスの Activity、Lane、接続、責任境界越えを視覚的に追えるリファレンス実装にする。

## 背景

- 目的は、Responsible の概念を説明するための汎用 UI ではなく、Activity と Lane を中心にした業務プロセス可視化のリファレンス実装を作ることである。
- 既存実装は前提にしない。
- Vite ベースの現行フロントエンド構成は使用してよい。
- 依存性削減の原則は responsible 本体への制約であり、リファレンス実装では可視化を優先する。
- React Flow 相当の表現ができる構成にする。ただし、ライブラリ採用は実装時に判断する。
- データはまず静的サンプルでよい。
- プロセス定義と viewer 表示ロジックを分離する。

## 問題

現在のリファレンス実装は、業務プロセスの可視化に純粋特化した viewer ではない。
Activity を node として表示し、Lane を責任境界・担当領域・処理領域として表示し、Activity 間の接続や Lane をまたぐ引き渡しを追える 1 画面の node-based viewer が必要である。

## 目標

1 画面で完結する node-based viewer を実装し、Activity、Lane、connection、境界越えを同時に表示できる状態にする。
プロセス切り替え、選択中 Activity の詳細確認、zoom / pan に対応し、3種類の静的サンプルプロセスを切り替えて閲覧できるようにする。

## 対象外

- 建設業務向けアプリを作ること。
- 汎用 BPMN エディタを作ること。
- 完全な編集機能を作ること。
- Responsible の全概念を UI に詰め込むこと。
- 現在の実装を段階的に改善すること。

## 提案する方針

1. 既存実装を前提にせず、1画面構成の node-based viewer として UI を再設計する。
2. Activity を業務上の意味を持つ処理単位として node 表示し、Activity 間の接続でプロセスの流れを表す。
3. Lane を Activity が属する責任境界、担当領域、または処理領域として横方向または縦方向に表示する。
4. Lane をまたぐ接続により、責任境界を越える作用や引き渡しを表す。
5. zoom / pan により全体俯瞰と詳細確認を切り替え、大きなプロセスを閲覧できる土台を作る。
6. プロセス定義と viewer 表示ロジックを分離し、まずは静的サンプルデータで実装する。
7. React Flow 相当の表現ができる構成にする。ライブラリを採用するかは、既存構成、依存性、実装コストを確認して決める。
8. 建設会社の業務プロセスではなく、構造を説明しやすい次の3種類のサンプルプロセスを実装する。
   - ソフトウェア開発プロセス: Issue triage、Design、Implementation、Review、Test、Release。
   - ドキュメント作成・レビュー・公開プロセス: Draft、Review、Revise、Approve、Publish、Archive。
   - AI agent / tool execution process: User request、Context collection、Planning、Tool execution、Verification、Response。

## 受け入れ条件

- [ ] 現在の実装を前提にしない構成になっている。
- [ ] 1画面の node-based viewer が表示される。
- [ ] Activity がノードとして表示される。
- [ ] Lane が表示される。
- [ ] zoom / pan ができる。
- [ ] 3種類のサンプルプロセスを切り替えられる。
- [ ] 各サンプルが Activity、Lane、connection を持つ。
- [ ] Activity の入出力や前後関係が視覚的に追える。
- [ ] Lane をまたぐ接続により、責任境界を越える作用や引き渡しが分かる。
- [ ] 選択中の Activity の詳細を確認できる。
- [ ] 建設会社固有のサンプルに依存していない。
- [ ] 業務プロセス可視化に目的が絞られている。

## テスト計画

- `npm run check` を実行し、既存の検査が成功することを確認する。
- `npm run build` を実行し、フロントエンドがビルドできることを確認する。
- ブラウザで viewer を開き、1画面内に Activity node、Lane、connection が同時に表示されることを確認する。
- 3種類のサンプルプロセスを切り替え、それぞれ Activity、Lane、connection が表示されることを確認する。
- zoom / pan を操作し、全体俯瞰と詳細確認を切り替えられることを確認する。
- Activity を選択し、詳細表示が選択内容に追従することを確認する。
- サンプルに建設会社固有の業務プロセスが含まれていないことを確認する。

## リスク

- React Flow 相当のライブラリを採用する場合、リファレンス実装の依存関係が増える。
- viewer を作り直すため、既存 UI に依存した説明やテストがある場合は更新が必要になる。
- zoom / pan、Lane、node layout を同時に扱うため、手動実装では表示品質や操作性の調整コストが高くなる可能性がある。

## 変更履歴

`CHANGES.md` impact: yes

項目案：

- Rebuild the reference implementation as a node-based business process viewer focused on Activity, Lane, connections, and zoom / pan.

## 注記

- GitHub Issue labels: none
- GitHub Issue createdAt: 2026-06-24T22:15:00Z
- GitHub Issue updatedAt: 2026-06-24T22:15:00Z
- クローズコメント: `Captured as local issue. issues/open/20260625-rebuild-process-viewer.md`
