# 非線形射影の設計

[English](nonlinear-projection.md) | 日本語

この文書は、Responsibility Boundary Normal Form の projection を v0 の線形フローのサブセットを越えて拡張するための設計目標を定義する。非線形 projection の作業に対して規範的（normative）である。

## 実装状況

ここで説明する中核となる quotient projection は、`src/quotient.ts` に `projectDagByResponsibilityBoundary` として実装されており、`src/__tests__/quotient.test.ts` でカバーされている:

- 有限な DAG 上の分岐と合流がサポートされる。循環と弱く接続していないスコープは、明示的なエラーで拒否される。
- パーティショニングは、induced された同一境界サブグラフの、最大の弱連結な同一境界コンポーネントを使う（以下で v1 サブセットと呼ぶもの）。
- 線形の場合は特殊なケースである: 線形モデルに対しては、結果は `projectByResponsibilityBoundary`（より厳格な v0 線形 projector として維持される）と byte 単位で同一になる。
- 型参照ポリシー（下記参照）: 単一の entry/exit ref はそのまま保持される。複数の異なる ref は `" & "` で product 的に結合される（同時に必須）。代替案は、`Result` / union の出力型によるモデラーの明示的な選択として残される。
- スキーマ / バージョンの判断: 非線形 projection は `responsible.v0` データに対する projection の能力であり、`responsible.v1` のモデルメタデータを必要としない。
- リファレンスビューアは DAG projector を使う。`見積承認（分岐・合流）` サンプルプロセスは、すべての境界レベルで分岐と合流を検証する。

残っている今後の作業: 並列の意味論、例外パスの表示、そしてより豊かなビューアのエッジルーティング。ループの意味論は [`docs/loops.md`](loops.ja.md) で定義済みであり、その段階実装が入るまで循環は拒否され続ける。

## グラフのクラス

最初の非線形実装の対象は、有限で有向な非循環（acyclic）Activity グラフである。

- 分岐と合流はスコープ内である。
- 並列に見える領域は、後で合流する DAG の分岐として表現される。
- 循環は本書のスコープ外である。その意味論は別途 [`docs/loops.md`](loops.ja.md) で定義される。
- 例外パスは、通常 `Result` / union の出力を伴う、型付きの分岐としてモデル化される。

現在の線形のケースは、非線形設計の特殊なケースであり続けなければならない。

## Quotient のルール

選択された Responsibility Boundary 表現に対して、各 leaf Activity には `boundaryOf(activity, boundary)` によって境界が割り当てられる。

Projection されたグラフは quotient グラフである:

1. 選択されたスコープの leaf Activity によって induced されるサブグラフを構築する。
2. Leaf を、induced されたグラフ上の弱連結性を用いて、同じ projection された境界を持つ最大の連結コンポーネントに分割する。
3. 各コンポーネントは 1 つの projection された Activity になる。
4. 元の flow の少なくとも 1 つが、それらのソースコンポーネント間を跨ぐ場合、projection された Activity 間にエッジが存在する。
5. 同一コンポーネント内の flow によって導入される self-edge は隠される。

これは現在の線形の挙動を保存する: 連続する同一境界の実行は、1 つの合成された projection された Activity になる。

## 型の合成

Projection されたコンポーネントの入力型と出力型は、グラフの境界エッジから導出される。

- コンポーネントの入力は、外部からコンポーネントに入るソースグラフの入力に加え、開始コンポーネントに対する root スコープの入力である。
- コンポーネントの出力は、コンポーネントから出て行くターゲットグラフの出力に加え、終端コンポーネントに対する root スコープの出力である。
- 単一の入力または出力は、元の `TypeRef` を保持する。
- 複数の代替案は union 型の型参照を使う。
- 並列または同時に必須の値は、record / product 型の型参照を使う。
- 分岐する Activity は、通常 `Result` または union の参照を用いて、出力型で分岐の選択を明示すべきである。

この設計は、v0 が具体的な `TypeDef` レコードを自動的に合成することを要求しない。将来の実装 issue が、生成されるコンポーネント型参照を structural、named、あるいは opaque のどれにするかを判断する必要がある。

## 拡張された不変条件

v0 の不変条件は次のように拡張される:

- `INV-1`: Projection は、任意の DAG に対して読み取り専用のままである。
- `INV-2`: Mutation は projection の関心事ではなく、実行の関心事のままである。
- `INV-3`: directed な effect は、quotient 化された後も既知の source boundary と target boundary を要求する。
- `INV-4`: Projection は、選択された drill-down スコープ内の leaf Activity から行われ続ける。
- `INV-5`: quotient グラフは lossy であり非可逆である。
- `INV-6`: 各 quotient コンポーネントは、入力と出力の型参照を持つ、Activity の形をした projection されたコンポーネントのままである。
- `INV-7`: projection されたグラフには、quotient のルールの下でマージできたはずの、異なる同一境界コンポーネント間のエッジが含まれない。
- `INV-8`: projection されたグラフは、ソースとなる DAG からの境界越えの観測間の到達可能性を保存する。

## 例

### 分岐と合流

```text
A(team: Product) -> B(team: Engineering) -> D(team: Release)
                \-> C(team: QA) --------/
```

`team` の境界では、quotient は Product -> Engineering -> Release と Product -> QA -> Release になる。Engineering と QA の境界が異なるため、これらは別々のままである。

`company` の境界では、すべての Activity が 1 つの境界を共有し、1 つの projection されたコンポーネントに collapse する。

### 同一境界内の分岐

```text
A(team: Product) -> B(team: Engineering) -> D(team: QA)
                \-> C(team: Engineering) -/
```

`team` の境界では、B と C は、異なる境界を持つノード（A/D）を経由してのみ弱く接続されている。そのため、実装がそれらが 1 つの同一境界コンポーネントであることを証明するより厳格な region 解析を選択しない限り、B と C は別々の Engineering コンポーネントのままである。v1 サブセットは、induced された同一境界サブグラフにおける最大の連結な同一境界コンポーネントから始めるべきである。

## 実装の分割

今後の作業は、次のように分割すべきである:

1. コアの projection: DAG の検証、quotient のパーティショニング、エッジの collapse、型参照導出ポリシー、そしてテスト。
2. ビューアのレイアウト: 分岐と合流のための lane レイアウト、エッジルーティング、選択の挙動。
3. スキーマ / バージョンポリシー: 非線形 projection が `responsible.v1` のモデルメタデータを要求するか、`responsible.v0` データに対する projection の能力のままであるかを判断する。

最初の実装 issue は、分岐と合流のみを対象とすべきである。並列の意味論と例外パスの表示は、quotient とレイアウトの契約が安定した後に続けることができる。
