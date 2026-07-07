# responsible

[![CI](https://github.com/f4ah6o/responsible/actions/workflows/ci.yml/badge.svg)](https://github.com/f4ah6o/responsible/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node.js >= 22.18](https://img.shields.io/badge/node-%3E%3D22.18-brightgreen)

**型付き Activity と責任境界による業務プロセスモデリング。**

[English](README.md) | 日本語

`responsible` は、業務を型付き Activity — `Activity<Input, Output>` — の合成としてモデル化し、選択した _責任境界_ への射影によって、同じモデルを任意の組織粒度で表示する。依存ゼロの小さなセマンティックコアと、インタラクティブなノードベースのプロセスビューアで構成される。

**[ライブデモ →](https://f4ah6o.github.io/responsible/)**

---

## なぜ作ったか

BPMN 風の図は 3 つのものを混在させている。仕事が _何であるか_、誰が _責任を持つか_、どう _描くか_。`responsible` はこれらを分離する。

- **Activity** が唯一のモデリング原始概念であり、`Input -> Output` の型付き業務関数である。Gateway・Trigger・Start / End イベントは特別な実体ではない。分岐は判定結果を出力する Activity、Trigger は上流(外部の場合もある)Activity の Output、Start / End は単なる View の境界である。
- **責任**は Activity に付与される属性(`company / department / section / team / person`、あるいは任意の軸)であり、モデルそのものの構造ではない。
- **View は射影である。** プロセス図は計算で得られる。Activity グラフを境界へ射影し、同じ境界の連続 Activity を合成する(_Responsibility Boundary Normal Form_)。個人レベルの View から会社レベルの View へのズームは境界を変えるのであって、モデルは変えない。

```text
ProcessView = normalize(project(ActivityGraph, boundary))
```

把握している最も細かい粒度で一度だけ書いたモデルから、職能型・階層型・マトリクス型を問わず、組織のあらゆるレベルに対して一貫した View が得られる。

## 特長

- **依存ゼロのセマンティックコア** — plain なデータ構造と純粋関数(`ProcessModel -> ProcessView`)で、不変条件 `INV-1`–`INV-6` を保証する。移植と検査が容易な設計。
- **分岐・合流を含む DAG 射影** — graph quotient projection(`projectDagByResponsibilityBoundary`)が非線形フローを扱う。循環はクラッシュせず明確なエラーとして拒否される。
- **boundary zoom** — 同じモデルの `company < department < section < team < person` の各 View を一段階ずつ切り替える。射影を変えない viewport pan / zoom とは別概念。
- **階層 drill-down** — Activity は無限に入れ子にでき、親は子の合成である。boundary zoom とは独立に、任意の分解スコープへ drill-down できる。
- **インタラクティブなビューア** — Activity ノード、責任境界レーン、境界間エッジ、入れ子レーンレイアウトを備えた単一画面の React Flow ビューア。
- **契約と作用(`responsible.v1`)** — Activity に `requires` / `ensures` / `effects` を宣言できる。宣言された effect はノード上のバッジと target 境界レーンへの破線エッジとして描画され、同一境界フローを合成するのと同じ規則で boundary zoom に応じて現れたり隠れたりする。
- **自分のモデルを表示** — ツールバーから任意の `responsible.v0` / `responsible.v1` JSON ファイルを読み込める。構造検証が JSON パス付きで問題を報告し、フラットなモデルは自動的に合成ルートで包まれる。読み込んだモデルは `localStorage` に永続化され、リロードしても一覧に残る。ツールバーから削除もできる。
- **共有可能な URL** — プロセス・boundary zoom レベル・drill-down スコープが URL ハッシュに同期されるため、リンクだけで同じ View を再現できる。読み込みモデルの場合は「共有リンクをコピー」でモデル本体を圧縮して URL(`#m=`)に埋め込むため、JSON ファイルを渡さなくても別のブラウザで同じ図を開ける。
- **クラッシュ耐性** — トップレベルのエラーバウンダリとその場のエラーパネルにより、未対応のモデルでも空白画面にならずメッセージが表示される。

## クイックスタート

必要環境: **Node.js >= 22.18** と **pnpm 10**。

```sh
git clone https://github.com/f4ah6o/responsible.git
cd responsible
pnpm install
pnpm dev        # ビューアは http://localhost:5173
```

その他のスクリプト:

```sh
pnpm run check      # フォーマット + lint チェック
pnpm run typecheck  # tsc --noEmit
pnpm test           # node:test(テスト依存ゼロ)
pnpm run build      # dist/ に本番ビルド
pnpm run preview    # 本番ビルドのプレビュー
```

## ビューアの使い方

ビューアにはサンプルプロセス(ソフトウェア開発、ドキュメント出版、AI エージェント実行、分岐・合流のある見積承認フロー、契約と作用を宣言した `responsible.v1` の申請承認フロー)が同梱されている。自分のプロセスを表示するには:

1. `responsible.v0` または `responsible.v1` の JSON モデルを書く。[`examples/order-fulfillment.json`](examples/order-fulfillment.json)(v0、受注〜請求の 6 Activity)か [`examples/application-approval.v1.json`](examples/application-approval.v1.json)(v1、`requires` / `ensures` / `effects` 付き)から始めるとよい。
2. ツールバーの **「JSON を読み込む」** をクリックする。読み込んだモデルは `localStorage` に保存され、リロード後もプロセス一覧に残る。不要になったら **「このモデルを削除」** で削除できる。
3. **boundary zoom** で組織レベルを移動し、**drill-down** で Activity の分解を開き、viewport pan / zoom でキャンバスを操作する。
4. **「共有リンクをコピー」** で URL を共有する。バンドル済みサンプルなら `#p=…&z=…&s=…` がプロセス・ズームレベル・スコープを表す。読み込みモデルの場合はモデル本体を deflate 圧縮して `#m=…&z=…&s=…` に埋め込むため、別のブラウザでリンクを開くだけで元の JSON ファイルなしに同じ図が再現される。モデルが大きすぎる場合はコピーを中止し、ツールバーに警告を表示する。
5. ツールバーの **SVG** / **PNG** をクリックすると、現在の表示(境界ズーム・ドリルダウン・composite 展開を反映)を `{プロセス名}-{境界レベル}.{svg|png}` というファイル名でエクスポートできる。PNG は `pixelRatio: 2` で出力され、文字が滲まない。エラーパネル表示中はエクスポートボタンが無効になる。

不正なモデルは JSON パス付きのエラーメッセージで報告される。循環を含むモデルは読み込めるが、該当スコープには図の代わりにエラーパネルが表示される。壊れた `#m=` 値(手で改変したリンクなど)も同様にエラーパネルを表示し、白画面にはならない。再検証に失敗した永続化モデル(将来のスキーマ変更など)は一覧に「読み込みエラー」として表示され、選択できない。ツールバーから削除できる。

UI はツールバーの **JA / EN** トグル(`src/viewer/i18n.ts`)で日本語・英語を切り替えられる。初期言語はブラウザの言語設定に従い、選択後は `localStorage` に保存される。Activity 名・responsibility 値・サンプルプロセス名などのモデルデータは翻訳対象外である。

## コアの使い方

射影と検証のコアはランタイム依存を持たず、ビューアなしでも使える。

```ts
import { parseProcessModelJson, ensureRootActivity } from "./src/index.js";

const result = parseProcessModelJson(jsonText);
if (!result.ok) {
  for (const issue of result.issues) console.error(issue.path, issue.message);
} else {
  const { model, rootActivityId } = ensureRootActivity(result.model);
  // 射影・正規化・描画…
}
```

コアはまだ npm に公開していない。リポジトリ内で使うか、`src/` を vendor すること(すべて [`src/index.ts`](src/index.ts) から re-export されている)。

## モデルを書く(エディタ支援)

`responsible.v0` / `responsible.v1` の JSON Schema(draft 2020-12)を [`schemas/`](schemas/) から `https://f4ah6o.github.io/responsible/schemas/responsible.v0.schema.json` / `…/responsible.v1.schema.json` として配信している。モデル JSON を手書きする際、エディタでのキー補完とインライン検証に使える。

モデル JSON に `$schema` フィールドを書くだけで、VSCode の組み込み JSON 言語サポートが自動的に読み込む:

```json
{
  "$schema": "https://f4ah6o.github.io/responsible/schemas/responsible.v1.schema.json",
  "schemaVersion": "responsible.v1",
  "activities": { ... }
}
```

あるいは VSCode の `settings.json` でファイルパターンにスキーマを紐付ければ、各ファイルを編集せずに済む:

```jsonc
{
  "json.schemas": [
    {
      "fileMatch": ["*.responsible.json"],
      "url": "https://f4ah6o.github.io/responsible/schemas/responsible.v1.schema.json",
    },
  ],
}
```

この Schema はエディタ支援のための補助であり、正ではない: [`src/model.ts`](src/model.ts) から手書きで作成しており、未知キーについてはランタイムのバリデータより厳格だが、`ActivityDef.id` がキーと一致すること・`flows` の参照先が解決すること・分解階層の循環がないことといった参照整合性チェックは表現していない — 引き続き `validateProcessModel`(後述)が正である。`$schema` プロパティは常に許容され、`validateProcessModel` はこれを無視する。

## モデルスキーマ(`responsible.v0`)

```ts
type ProcessModel = {
  schemaVersion: "responsible.v0";
  activities: Record<string, ActivityDef>;
  types: Record<string, TypeDef>;
  flows: FlowDef[];
  views: ViewDef[];
};

type ActivityDef = {
  id: string;
  name?: string;
  input: TypeRef; // 入力データ型
  output: TypeRef; // 出力データ型
  responsibility?: Record<string, unknown>; // 例: company/department/section/team/person
  children?: string[]; // 子 Activity への分解
  status?: "discovered" | "defined" | "validated" | "automatable";
};

type FlowDef = { from: string; to: string; mapping?: string; contract?: string };
```

正式な型定義は [`src/model.ts`](src/model.ts)、構造検証は [`src/validate.ts`](src/validate.ts) にある。完全な動作例は [`examples/order-fulfillment.json`](examples/order-fulfillment.json) を参照。

### `responsible.v1`(契約と作用)

`responsible.v1` は v0 に、Activity 上のオプショナルな宣言的フィールドを追加する: `requires` / `ensures`(不透明な事実参照)と `effects`(観測可能な payload と境界横断の配送規則 — `directed` / `broadcast` / `observable`)。v1 は v0 の厳密な上位集合であり、検証は両バージョンを受け入れ、`migrateProcessModelToV1` は `schemaVersion` の書き換えだけで v0 文書を移行する。規範設計と段階的計画は [`docs/responsible-v1.md`](docs/responsible-v1.md) にある。宣言された effect は `projectEffects`(`src/effects.ts`)で選択した境界へ射影される: 選択ビューで単一境界の内部に留まる directed effect は内部的(`tau`)として隠され、未知の directed target は `INV-3` 違反として報告される。viewer は観測可能な effect をノードバッジとレーン横断の破線エッジとして描画する。同梱サンプル `申請承認(契約と作用)` を参照。

## ドキュメント

| ドキュメント                                                                                                    | 内容                                                                                               |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [`docs/semantic-core.md`](docs/semantic-core.md)                                                                | **規範的（normative）** な意味論: Activity、責任境界、Projection、RBNF、不変条件                   |
| [`docs/theory.md`](docs/theory.md)                                                                              | 理論的背景と、理論から実装への対応付け                                                             |
| [`docs/reference-implementation.md`](docs/reference-implementation.md)                                          | リファレンス実装のスコープと依存ポリシー                                                           |
| [`docs/nonlinear-projection.md`](docs/nonlinear-projection.md)                                                  | DAG graph quotient projection の設計                                                               |
| [`docs/responsible-v1.md`](docs/responsible-v1.md)                                                              | **規範的（normative）** な `responsible.v1` スキーマ設計（契約と作用）と段階的計画                 |
| [`docs/loops.md`](docs/loops.ja.md)                                                                             | **規範的（normative）** なループ（サイクル）射影の意味論——戻りエッジ、tau ループ規則——と段階的計画 |
| [`docs/activity-effects.md`](docs/activity-effects.md) / [`docs/data-and-effects.md`](docs/data-and-effects.md) | Effect モデル: 境界を跨いで観測可能な plain data としての effect                                   |
| [`docs/research-report.md`](docs/research-report.md)                                                            | 背景研究（非規範）                                                                                 |

## アーキテクチャ

```text
src/
  model.ts       ProcessModel / ProcessView のデータ型（responsible.v0 / v1）
  validate.ts    構造検証、JSON パース、合成ルートによる包み込み
  migrate.ts     v0 -> v1 スキーママイグレーション
  boundary.ts    責任境界の解決
  hierarchy.ts   boundary zoom レベル（company … person）
  quotient.ts    DAG graph quotient projection（分岐・合流）
  normalize.ts   Responsibility Boundary Normal Form
  graph.ts       フローグラフのヘルパー
  semantic.ts    セマンティックコアの語彙型、Effect、不変条件ヘルパー
  effects.ts     宣言された v1 effect の境界への射影（projectEffects）
  viewer/        React + React Flow リファレンスビューア
  __tests__/     node:test スイート（不変条件、射影、ズーム、検証）
```

**射影コア**(`src/viewer/` 以外のすべて)は依存ゼロである。React、`@xyflow/react`、`html-to-image`(SVG/PNG エクスポート)に依存するのはビューアのみ。DSL パース、永続化、実行ランタイムは意図的に下流レイヤーとし、このリポジトリのスコープ外とする。

### 非目標

`responsible` はセマンティックコアとビューアである。BPMN ランタイム、RACI チャートツール、Event Sourcing ランタイム、Actor ランタイム、State Machine ランタイムでは **ない** — それらは射影の下流に構築できる。

## プロジェクトの状態

バージョン `0.x` — API と JSON スキーマ(`responsible.v0` / `responsible.v1`)はマイナーバージョン間で変わる可能性がある。コアはセマンティックコアのうち検証可能なサブセットを実装している: 不変条件 `INV-1`–`INV-6`、plain data としての `Effect`、DAG 射影、そして `responsible.v1` では [`docs/responsible-v1.md`](docs/responsible-v1.md) に基づく契約の宣言と境界へ射影される作用。実行 API と逆射影 API は持たない。ループ（サイクル）の意味論は [`docs/loops.md`](docs/loops.ja.md) で定義済みであり、その段階実装が入るまでプロジェクタは循環を拒否し続ける。

主要な変更は [`CHANGES.md`](CHANGES.md) に記録している。

## コントリビュート

Issue と Pull Request を歓迎する。PR を送る前に、品質ゲート一式がローカルで通ることを確認してほしい。CI もすべての PR で同じステップを実行する。

```sh
pnpm run check && pnpm run typecheck && pnpm test && pnpm run build
```

モデルの意味論に関わる変更については [`docs/semantic-core.md`](docs/semantic-core.md) が規範である。コード・テスト・当該ドキュメントの整合性を保つこと。

## デプロイ

`main` への push で [`.github/workflows/pages.yml`](.github/workflows/pages.yml) によりビューアが GitHub Pages にデプロイされる。CI([`.github/workflows/ci.yml`](.github/workflows/ci.yml))は PR と `main` で check / typecheck / test / build を実行する。

## ライセンス

[MIT](LICENSE)
