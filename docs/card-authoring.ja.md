# Card authoring layer（カードによる作成レイヤ）

[English](card-authoring.md) | 日本語

このドキュメントは、ビューアに追加された Magica 風カード authoring mode（[issue #42](https://github.com/f4ah6o/responsible/issues/42)）と、その最重要ルールであるレイヤ分離を説明する:

> **カード UX は authoring layer。responsible core は semantic layer。**

カードは、JSON ではなく業務カードで考える人のための入力語彙である。正規の内部表現は変わらず `responsible.v1` の `ProcessModel`（typed Activity、flow、責任境界）であり、カードレイヤはそこへ**変換する**だけで、拡張はしない。`src/model.ts`・`src/validate.ts`・射影コアに Magica 固有の概念は存在しない。

参考: [マジカ](https://www.magicaland.org) — 業務フローを誰でも書けるカードとして扱う手法。

## 配置

| 要素                           | 場所                                                    | 依存先                                              |
| ------------------------------ | ------------------------------------------------------- | --------------------------------------------------- |
| カードデッキの型と操作         | `src/viewer/authoring/cardDeck.ts`                      | コア型のみ（`ActivityStatus`、`EffectPayloadKind`） |
| デッキ → モデル アダプタ       | `src/viewer/authoring/deckToModel.ts`                   | `src/model.ts` の型                                 |
| ドラフト永続化                 | `src/viewer/authoring/deckStorage.ts`                   | `localStorage`（`responsible.authoring.deck.v1`）   |
| サンプルデッキ                 | `src/viewer/authoring/sampleDeck.ts`                    | —                                                   |
| authoring UI                   | `src/viewer/authoring/*.tsx`                            | React、`@xyflow/react`                              |
| 検証                           | **再利用**: `validateProcessModel`（`src/validate.ts`） | —                                                   |
| 射影 / boundary zoom / effects | **再利用**: 既存のコアとビューア                        | —                                                   |

デッキ（`CardDeck`）はシリアライズ可能な authoring 状態であり、カード・接続・担当カード（lane hint）・キャンバス上の座標を持つ。座標はモデルには一切出力されない。

## カード種別 → `responsible.v1`

| カード種別                                        | UI                                                                                        | 変換先                                                                                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **業務カード（Activity card）**                   | キャンバス上のノード                                                                      | `ActivityDef` — `name`（業務名）、`input`、`output`、`responsibility`、`status`、および下記の v1 フィールド                                                                   |
| **判断カード（Decision card）**                   | キャンバス上のノード（破線枠）、`outcomes` リスト付き                                     | `output` が判断結果型である通常の `ActivityDef`。**gateway ではない** — semantic core に gateway 概念は存在しない。                                                           |
| **接続（Flow connection）**                       | カード間に引くエッジ                                                                      | `FlowDef { from, to, mapping?, contract? }`。判断カードから出る接続に分岐結果 `approved` を選ぶと `mapping: "when output = approved"` が出力される。明示的な mapping が優先。 |
| **担当カード（Responsibility card / lane hint）** | パレット内の再利用可能なプリセット（選択中のカードに適用）と、詳細パネルの 5 軸フィールド | `activity.responsibility`（値の入った軸のみ出力）                                                                                                                             |
| **条件カード（Condition card）**                  | 選択中カードの requires / ensures リスト                                                  | `activity.requires` / `activity.ensures`（`FactRef[]`）                                                                                                                       |
| **作用カード（Effect card）**                     | 選択中カードの作用サブカード                                                              | `activity.effects`（`EffectDef[]`。`directed` の配送先は値の入った軸だけの `Responsibility` として出力）                                                                      |

Group / 分解カードと Document（モデル `types`）カードは初期スコープ外である。生成モデルはフラットで、取り込み時にビューアの既存 `ensureRootActivity` が合成ルートで包む — フラットな JSON ファイルの場合とまったく同じ動作である。

## データフロー

```text
カードデッキ（authoring 状態、localStorage のドラフト）
        │  deckToProcessModel（純粋関数、throw しない）
        ▼
responsible.v1 JSON  ──►  validateProcessModel（authoring 画面のライブ検証）
        │  「ビューアーで開く」=「JSON を読み込む」と同一経路
        ▼
parseProcessModelJson → ensureRootActivity → localStorage の取り込み一覧 → ビューア
        ▼
射影 / RBNF / boundary zoom / drill-down / effects / 共有リンク（変更なし）
```

構造上の問題（input/output が空、接続先の欠落、空のデッキなど）はアダプタでは防がない。既存バリデータが JSON パス付きの issue として報告し、モデルが valid になるまで「ビューアーで開く」「JSON をエクスポート」は無効のままになる。

## カード ID

カード ID は作成時に一度だけ生成され（`activity-1`、`decision-2`、…）、名前を変えても変わらず、生成モデルの Activity ID になる。接続 ID（`flow-n`）はデッキ内にのみ存在し、`FlowDef` は ID なしで出力される。

## 受け入れ条件（issue #42）

- カード UI だけで小さな業務プロセスを作成でき、`responsible.v1` としてエクスポート / 再インポートできる。
- 同梱の `application_approval` v1 サンプルを組み込みサンプルデッキで再現できる。`src/__tests__/card-authoring.test.ts` が、生成モデルがサンプルの leaf Activity・flow と一致すること、`validateProcessModel` を通ること、全 boundary zoom レベルで射影（`projectEffects` 含む）できることを検証する。
- JSON authoring とローダは引き続き第一級の入力手段である。カードモードは追加の入口であり、置き換えではない。

## 非目標

- Magica そのものの完全再実装はしない。
- カード構造に合わせた semantic core の変更はしない。
- BPMN / RACI / state machine ツールへの方向転換はしない。
- 初期スコープに逆方向アダプタ（モデル → カード）は含めない。カードモードは新しいデッキを作るためのものであり、既存の JSON モデルはビューアで表示する（カードに分解はしない）。
