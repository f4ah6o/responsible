# 階層境界ズームに `tool` レベルを追加する（Stage 1）

Status: open
Model: Claude
Created: 2026-07-07
Updated: 2026-07-31

## 概要

[`docs/workflow-discovery.md`](../../docs/workflow-discovery.md) の Stage 1 として、viewer の階層境界順序へ最詳細レベル `tool` を追加する。

```text
company < department < section < team < person < tool
```

`tool` はアプリケーションや道具を表す責任軸であり、新しい意味論プリミティブではない。既存の quotient / RBNF 規則は変更しない。

## 重要な射影規則

`tool` ビューは出現単位のトレースビューではない。同じツール境界を持つ隣接 Activity は既存規則どおり composite に畳み込まれる。

- Excel → Excel: `tool` 射影では1つの連続区間になり得る。
- Excel → Outlook → Excel: 同じ Excel が隣接しないため3ノードとして残る。
- 同一担当者の連続作業: `person` 射影ではさらに畳み込まれ得る。

出現単位の詳細は射影前の `ProcessModel` が保持する。RBNFを回避するために出現IDを `tool` 値へ混入させない。

## 実装

1. `src/hierarchy.ts`
   - `HIERARCHICAL_BOUNDARY_ORDER` の末尾に `"tool"` を追加する。
2. viewer
   - 日英ラベルを追加する。
   - URL のズームレベル最大値を6段階へ更新し、既存インデックスは維持する。
3. サンプル
   - `tool` 軸を持つサンプルを追加または既存サンプルへ付与する。
   - 同一ツールの隣接作業と、別ツールを挟んだ再訪の双方を含める。
4. 文書
   - 階層順序の記載を `person < tool` まで更新する。

## 受け入れ条件

- [ ] `HIERARCHICAL_BOUNDARY_ORDER` が6レベルになる。
- [ ] viewer で `tool` までズームでき、共有URLから復元できる。
- [ ] `tool` を持たない Activity は `<unassigned>` tool lane に入る。
- [ ] 同一ツールの隣接 Activity は `tool` 射影で composite になる。
- [ ] 別ツールを挟んだ同一ツールへの再訪は別ノードとして残る。
- [ ] `person` 射影では同一担当者の連続区間が畳み込まれる。
- [ ] 既存モデルと既存URLのズームインデックスに後方互換性がある。
- [ ] リポジトリの全品質ゲートが通る。

## テスト

- hierarchy: レベル数、zoom in/out、clamp。
- lanes: person の子として tool lane が構築されること、`<unassigned>`。
- projection:
  - Excel A → Excel B は tool composite。
  - Excel → Outlook → Excel は tool で3ノード。
  - 同一 person の連続区間は person composite。

## 対象外

- 操作ログパーサと発見変換（Stage 2）。
- Windows 記録スクリプト（Stage 3）。
- 出現を一切畳み込まない専用トレースビュー。
