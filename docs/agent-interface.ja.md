# Agent / CI インターフェース

`responsible` は CI、coding agent、LLM tool adapter から利用できる、依存ゼロの安定した CLI surface を提供する。契約バージョンは `responsible.cli.v1` である。

このインターフェースは UI 自動操作や BPMN 図形編集ではなく、意味データを中心にする。Agent は viewer を開かずに、生成モデルの検証、移行、任意の責任軸への射影、運用意味の解析を実行できる。

## Capability discovery

インストール済み package version が不明な場合、コマンドを組み立てる前に capability を取得する:

```sh
responsible capabilities --compact
```

返される JSON は、対応 schema version、stdin の扱い、境界式の構文、command、output 種別、終了コードを宣言する。互換性を保った optional field の追加はあり得るが、既存の `responsible.cli.v1` field の意味は維持する。

## 入力契約

各 command は UTF-8 JSON file を受け取る。file name `-` は stdin から1文書を読む:

```sh
cat generated.responsible.json | responsible validate - --format json
```

1回の command invocation に `-` を複数指定してはならない。`migrate`、`project`、`analyze` は入力1件、`validate` は1件以上を受け取る。

## 決定論的 JSON

`migrate`、`project`、`analyze`、`capabilities` は JSON を stdout に出力する。tool transport 用の1行表現には `--compact` を使う。

`validate --format json` は次の envelope を stdout に出し、成功 file の診断を stderr に出さない:

```json
{
  "protocolVersion": "responsible.cli.v1",
  "command": "validate",
  "ok": true,
  "results": [{ "source": "model.json", "ok": true }]
}
```

invalid result には `issues` array が追加され、各 entry は JSON-style の `path` と人間可読の `message` を持つ。

## 境界式

責任軸はモデル定義であり、一般的な `company / department / section / team / person` 組織 lane に限定されない。

単一 key は1軸を選ぶ:

```sh
responsible project model.json --boundary system
```

カンマ区切り key は複合境界 path を選ぶ:

```sh
responsible project model.json --boundary company,department
```

`organization.department` のような nested responsibility value には dotted key を使える。

## 意味解析

`responsible analyze` は公開 API `analyzeProcessModel` を呼び、次の5 section を返す:

- `summary`: Activity、leaf/composite、flow、type、view、status の件数。
- `topology`: entry、exit、isolated Activity、強連結な flow cycle。
- `semantics`: 責任 key、contract 宣言率、effect 件数、参照 type。
- `responsibility`: assigned/unassigned Activity、boundary group、境界間 handoff。
- `automation`: `automatable` 宣言、明示的 readiness signal、不足宣言。

```sh
responsible analyze model.json --boundary department --compact
```

`readySignalActivityIds` は保守的なモデリングシグナルであり、安全に実行可能であることの証明ではない。leaf Activity であり、`status: "automatable"`、選択責任境界で担当解決済み、`requires` と `ensures` の両方を宣言済みの場合だけ含まれる。runtime availability、authorization、idempotency、failure recovery、effect execution は downstream の責務である。

責任、contract、effect、成熟度を同時に保持するこの解析が、control-flow notation を越えて推論するための中心 interface である。

## 終了コード

| Code | 意味                                                          |
| ---: | ------------------------------------------------------------- |
|  `0` | 成功                                                          |
|  `1` | invalid model、projection failure、analysis operation failure |
|  `2` | CLI 使用法エラー                                              |

Agent はまず数値 code で分岐し、その後 command と output format に応じて stdout / stderr を解析する。

## 推奨 agent sequence

```sh
responsible capabilities --compact
responsible validate candidate.json --format json --compact
responsible analyze candidate.json --boundary department --compact
responsible project candidate.json --boundary company,department --compact
```

独立 command を orchestration する場合は validate を先に実行する。各モデル操作 command も内部で再検証する。
