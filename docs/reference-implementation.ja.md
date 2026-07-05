# リファレンス実装ポリシー

[English](reference-implementation.md) | 日本語

このリポジトリの実装はリファレンス実装であり、唯一の runtime ではない。

リファレンス実装は、`ProcessView` をレンダリングする、単一画面のノードベースの **業務プロセスビューア** を中心にしている: Activity ノード、責任境界の Lane、境界を跨ぐ接続、そして viewport の pan / zoom である。`ProcessView` を生成する純粋な projection コアは、検査、移植、置き換えが容易な小さいサイズのまま保たれる。

## 依存ポリシー

純粋な projection コアは依存ゼロのままである。リファレンスビューアは可視化ライブラリに依存することが許されている。

```text
core runtime dependencies: 0
viewer runtime dependencies: react, react-dom, @xyflow/react
reference language: TypeScript / JavaScript
```

コア(`src/model.ts`、`src/boundary.ts`、`src/hierarchy.ts`、`src/normalize.ts`、`src/semantic.ts`、`src/graph.ts`、`src/validate.ts`、`src/index.ts`)は、純粋関数と plain なデータ構造を持つ plain な TypeScript のままである。React、Vue、Svelte、canvas ライブラリ、グラフレイアウトエンジン、スキーマ検証ライブラリ、パーサージェネレータを import してはならない。モデル検証(`src/validate.ts`)は、スキーマ検証ライブラリへの依存ではなく、plain なデータに対する手書きの純粋関数である。

コアパッケージは、純粋関数と plain なデータ構造を公開する。

```text
ProcessModel -> ProcessView
```

ビューアは `ProcessView` を消費し、React Flow を使ってノード / lane の UI としてレンダリングする。ビューアはモデルの下流にあり、可視化の関心事をコアに戻すことは決してない。

## リファレンス実装のスコープ

リファレンス実装は、セマンティックコアとビューアをカバーする:

1. Activity モデル
2. Input / Output の型参照
3. 責任属性
4. 境界の解決
5. Responsibility Boundary Normal Form の projection
6. Plain な JSON 直列化可能な view モデル
7. 選択可能な drill-down / drill-out スコープとしての Activity の `children`
8. ノードベースのプロセスビューア（React Flow）: Activity ノード、責任境界の Lane、境界を跨ぐ接続、viewport の pan / zoom、boundary zoom、そして Activity の分解スコープコントロール

コアには、次のものを含めるべきではない:

1. グラフレイアウトエンジン
2. BPMN runtime
3. DSL パーサー
4. 永続化層
5. サーバーフレームワーク
6. 検証ライブラリ

これらは、モデルが安定した後に、別個のアダプタとして追加できる。ビューアは React と React Flow を使うことができるが、コアは使うことができない。

## Zoom と分解

`README.md`（`Digital zoom`、`Design principles`）に従い、**zoom は責任境界のレベルを選ぶことを意味し**、Activity の分解階層を移動することではない。ビューアは、3 つの分離された、重複しない操作を維持する:

```text
boundary zoom    = choose responsibility boundary level (hierarchical)
viewport pan/zoom = visual pan and zoom of the canvas (whole-overview vs. detail)
drill-down       = choose Activity decomposition scope (children)
```

`boundary zoom` と `viewport pan/zoom` は "zoom" という単語を共有しているが、異なる概念である。Boundary zoom は、固定されたスコープに対して、異なる責任レベルで projection を再計算する。Viewport の pan/zoom は、キャンバスを移動 / 拡大縮小するだけで、projection を変えることはない。

### 責任境界の zoom

階層的な責任境界は、最も粗いレベルから最も詳細なレベルまで順序付けられている:

```text
company < department < section < team < person
```

この順序付けられた定数(`src/hierarchy.ts`、`src/index.ts` から re-export される)は、boundary zoom の唯一の信頼できる情報源である。zoom in は `person` に向かって 1 段階移動し、zoom out は `company` に向かって 1 段階移動する。両端は clamp され、対応するボタンは両端で無効化される。ビューアは、専用の `BoundaryZoomControl` を通じてこれを公開する。

Zoom は固定されたスコープに対して動作する。zoom しても、表示されているプロセスの leaf の集合は変わらない:

```text
ProcessView = normalize(project(scope.leaves, boundaryLevel))
```

zoom のステップ間で変わるのは `boundaryLevel` だけである。同じ Activity Graph と同じ表示対象プロセスの leaf の集合が、すべてのレベルで projection される。ソフトウェア開発のサンプルの場合:

```text
company view:
  Acme Software

department view:
  Product -> Engineering -> Quality -> Platform

section view:
  Product Management -> Architecture -> Application -> QA -> Release Eng
```

### Viewport の pan / zoom

Viewport の pan / zoom は、React Flow（`Controls`、`MiniMap`、標準的な pan/zoom）によって提供される、視覚的なキャンバス操作である。全体概観と詳細表示の間を切り替える。責任境界のレベルを変えることは **なく**、projection された `ProcessView` を変えることも **ない**。boundary zoom とは独立している。

### Activity の分解（children）

親 Activity は `children` によって分解できる。v0 のビューアは、インタラクティブな drill-down / drill-out をスコープセレクタとして実装している: 現在のスコープの breadcrumb は親 Activity を移動し、projection は選択されたスコープの leaf Activity から再計算される。これにより、`zoom ≠ drill-down` がビューア内で物理的に分離される。

```text
projection  : project(displayedProcess.leaves, boundaryLevel)   (independent of children)
scope select: choose Activity decomposition scope (children)
```

## プロセスビューア

ビューアは、React Flow(`@xyflow/react`)で構築された、単一画面のノードベースの業務プロセスビューアである。コアから `ProcessView` を消費し、モデルにセマンティックな層を追加することなくレンダリングする。

```text
Activity    -> React Flow custom node
boundary    -> Lane (React Flow parent/group node, horizontal lanes stacked vertically)
cross-boundary transition -> edge that crosses Lanes
```

ビューアは、同一境界の実行が projection されたノードへ collapse された後の、正規化された projection されたグラフをレンダリングする。境界の値は、projection された flow の中で最初に現れた順に、上から下へ積み重なる水平な Lane としてレンダリングされる。Activity ノードは flow のインデックスによって左から右に配置され、境界を跨ぐエッジは、責任境界のハンドオフを可視化するために Lane を跨ぐ。

```text
layout(project(displayedProcess.leaves, boundaryLevel)) -> React Flow nodes + edges + lanes
```

ビューアはまた、プロセス選択（分岐 / 合流を含む見積承認フローを含む、構築が独立した 4 つのサンプルプロセス）、Activity 分解スコープコントロール、viewport の pan / zoom、そして分離された boundary zoom コントロールを提供する。`src/graph.ts` の依存ゼロの SVG レイアウトは、公開 API として維持されるが、もはやビューアからは使われていない。

さらに、ビューアはユーザー提供の `responsible.v0` JSON モデルの読み込みをサポートする(`src/viewer/ModelLoader.tsx`): ファイルはコア(`parseProcessModelJson`)によってパースおよび検証され、フラットなモデルは `ensureRootActivity` によって包まれ、検証エラーまたは v0 projection エラーは、アプリをクラッシュさせることなくその場に表示される（トップレベルの `ErrorBoundary` が予期しないレンダリングエラーを防ぐ）。現在のプロセス / boundary zoom レベル / 分解スコープは URL ハッシュに同期される(`src/viewer/urlState.ts`)ため、view はリンクとして共有できる。

## レイヤリング

```text
src/model.ts
  Data types only.

src/boundary.ts
  boundaryOf(activity, boundaryExpr).

src/hierarchy.ts
  Hierarchical responsibility-boundary zoom order and level helpers.

src/normalize.ts
  Responsibility Boundary Normal Form projection (v0 linear projector).

src/quotient.ts
  Graph quotient projection over DAGs (branching / merging); linear flows
  remain a byte-identical special case of the v0 linear projector.

src/graph.ts
  Dependency-free graph layout (public API kept; not used by the viewer).

src/semantic.ts
  Semantic vocabulary, plain-data Effect, directed-effect validation.

src/validate.ts
  Untrusted-input validation for ProcessModel (structural shape,
  referential integrity, decomposition-cycle detection), JSON parsing,
  and root inference / synthetic-root wrapping for flat models.

src/index.ts
  Public API exports (pure projection core only).

src/sample.ts
  Four construction-independent sample ProcessModels (one with branching
  and merging) and a registry.

src/main.tsx, src/viewer/
  React + React Flow viewer. Consumes ProcessView from the core.
  src/viewer/projectionToFlow.ts maps ProcessView to React Flow nodes/edges/lanes.
```

モデルが安定した後、将来のパッケージはコアとビューアを分割できる。

```text
@responsible/core       pure TypeScript projection core (dependency-free)
@responsible/viewer     React + React Flow reference viewer (this in-tree viewer)
@responsible/view-json  stable view projection format
@responsible/svg        optional SVG renderer
@responsible/dsl        optional parser / printer
```

パッケージ名は placeholder である。

## Projection の能力

v0 の projector(`projectByResponsibilityBoundary`)は、意図的に線形フローのみをサポートする。

```text
A -> B -> C -> D
```

これは、コアとなる発想を証明するのに十分である:

```text
same responsibility boundary run -> composite activity
```

分岐と合流は、`docs/nonlinear-projection.md` に従って実装された graph quotient projector(`src/quotient.ts` の `projectDagByResponsibilityBoundary`)によって扱われる。有限な DAG をサポートし、線形フローを byte 単位で同一な特殊ケースとして保ち、循環と弱く接続していないスコープを拒否する。ビューアは DAG projector を使う。

```text
implemented:
  linear flow projection (v0 projector, kept as the stricter subset)
  graph quotient projection over DAGs
  branching
  merging

later:
  loop semantics
  parallel semantics
  exception-path presentation
```

### Assertable なサブセット（v0）

現在の v0 は、`docs/semantic-core.md` のセマンティックコアのうち、assertable なサブセットのみを実装する。将来の実行 API は実装しない。

- `INV-1`–`INV-6` は、`src/__tests__/` 以下の実行可能な `node:test` テストでカバーされている。quotient projector はさらに、`docs/nonlinear-projection.md` の `INV-7` / `INV-8` のシナリオをカバーする。
- v0 の線形 projector は、分岐、合流、循環、複数の開始点、切断された flow を拒否する。DAG quotient projector は、分岐と合流を受け入れつつ、循環と弱く接続していないスコープは拒否し続ける。
- `Effect` は plain な、JSON 直列化可能なデータである。`validateDirectedEffect` は、宣言された source boundary が、選択された境界の下での source Activity の projection と一致すること、そして directed な target が既知の境界であることをチェックする。これは実行 API ではなく、`Effect` は `responsible.v0` のモデルスキーマに埋め込まれていない。
- 実行 API はない: `World`、`ActivityResult`、`seq`、そして runtime の `requires` / `ensures` predicate チェックは、将来のセマンティックな目標であり、v0 の API ではない。
- 逆 projection API はない: RBNF の collapse は非可逆として扱われる。

セマンティックな語彙(`BoundaryId`、`ActivityId`、`SchemaRef`、`Projection`、`RBNF`、`Effect`、opaque な `RequiresRef` / `EnsuresRef`)は、既存の `model`、`boundary`、`normalize`、`graph` の API と並んで、`src/index.ts` から追加的に re-export される。

## 設計上の制約

純粋な projection コアは、地味（boring）なままであるべきだ。

```text
plain objects
pure functions
no hidden runtime
no framework coupling
```

ビューアは React と React Flow を使うことが許されているが、コアは他言語へ移植可能なままである。フロントエンドの可視化は、モデルの consumer であり、モデルの所有者ではない。
