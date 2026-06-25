import type { Id, ProcessModel } from "./model.js";

export type SampleProcess = Readonly<{
  id: string;
  title: string;
  rootActivityId: Id;
  model: ProcessModel;
}>;

const softwareDevelopment: ProcessModel = {
  schemaVersion: "responsible.v0",
  activities: {
    software_development: {
      id: "software_development",
      name: "ソフトウェア開発",
      input: "未整理Issue",
      output: "リリース",
      status: "defined",
      children: ["issue_triage", "design", "implementation", "review", "test", "release"],
      responsibility: { company: "あかつきソフトウェア" },
    },
    issue_triage: {
      id: "issue_triage",
      name: "Issueを分類する",
      input: "未整理Issue",
      output: "分類済みIssue",
      status: "defined",
      responsibility: {
        company: "あかつきソフトウェア",
        department: "プロダクト部",
        section: "プロダクト管理課",
        team: "トリアージチーム",
        person: "佐藤",
      },
    },
    design: {
      id: "design",
      name: "設計する",
      input: "分類済みIssue",
      output: "設計書",
      status: "defined",
      responsibility: {
        company: "あかつきソフトウェア",
        department: "開発部",
        section: "アーキテクチャ課",
        team: "設計チーム",
        person: "鈴木",
      },
    },
    implementation: {
      id: "implementation",
      name: "実装する",
      input: "設計書",
      output: "プルリクエスト",
      status: "defined",
      responsibility: {
        company: "あかつきソフトウェア",
        department: "開発部",
        section: "アプリケーション課",
        team: "機能開発チーム",
        person: "高橋",
      },
    },
    review: {
      id: "review",
      name: "レビューする",
      input: "プルリクエスト",
      output: "レビュー済みPR",
      status: "validated",
      responsibility: {
        company: "あかつきソフトウェア",
        department: "開発部",
        section: "アプリケーション課",
        team: "機能開発チーム",
        person: "田中",
      },
    },
    test: {
      id: "test",
      name: "テストする",
      input: "レビュー済みPR",
      output: "テスト済みビルド",
      status: "validated",
      responsibility: {
        company: "あかつきソフトウェア",
        department: "品質保証部",
        section: "QA課",
        team: "テストチーム",
        person: "伊藤",
      },
    },
    release: {
      id: "release",
      name: "リリースする",
      input: "テスト済みビルド",
      output: "リリース",
      status: "automatable",
      responsibility: {
        company: "あかつきソフトウェア",
        department: "基盤部",
        section: "リリース管理課",
        team: "運用チーム",
        person: "小林",
      },
    },
  },
  flows: [
    { from: "issue_triage", to: "design", contract: "分類済みIssueとして設計へ渡せる" },
    { from: "design", to: "implementation", contract: "設計書が実装へ渡せる" },
    { from: "implementation", to: "review", contract: "プルリクエストがレビュー可能" },
    { from: "review", to: "test", contract: "レビュー済みPRがテスト可能" },
    { from: "test", to: "release", contract: "テスト済みビルドがリリース可能" },
  ],
  views: [
    { id: "person_view", layout: "lane", boundary: "person", normalForm: "responsibilityBoundary" },
    { id: "team_view", layout: "lane", boundary: "team", normalForm: "responsibilityBoundary" },
    {
      id: "section_view",
      layout: "lane",
      boundary: "section",
      normalForm: "responsibilityBoundary",
    },
    {
      id: "department_view",
      layout: "lane",
      boundary: "department",
      normalForm: "responsibilityBoundary",
    },
    {
      id: "company_view",
      layout: "lane",
      boundary: "company",
      normalForm: "responsibilityBoundary",
    },
  ],
};

const documentPublishing: ProcessModel = {
  schemaVersion: "responsible.v0",
  activities: {
    document_publishing: {
      id: "document_publishing",
      name: "文書公開",
      input: "構成案",
      output: "保管記録",
      status: "defined",
      children: ["draft", "doc_review", "revise", "approve", "publish", "archive"],
      responsibility: { company: "ビーコンメディア" },
    },
    draft: {
      id: "draft",
      name: "下書きを作成する",
      input: "構成案",
      output: "下書き",
      status: "defined",
      responsibility: {
        company: "ビーコンメディア",
        department: "制作部",
        section: "ライター課",
        team: "文書チーム",
        person: "三浦",
      },
    },
    doc_review: {
      id: "doc_review",
      name: "内容を確認する",
      input: "下書き",
      output: "確認済み下書き",
      status: "validated",
      responsibility: {
        company: "ビーコンメディア",
        department: "制作部",
        section: "編集課",
        team: "レビューチーム",
        person: "中村",
      },
    },
    revise: {
      id: "revise",
      name: "修正する",
      input: "確認済み下書き",
      output: "修正版",
      status: "defined",
      responsibility: {
        company: "ビーコンメディア",
        department: "制作部",
        section: "ライター課",
        team: "文書チーム",
        person: "三浦",
      },
    },
    approve: {
      id: "approve",
      name: "公開を承認する",
      input: "修正版",
      output: "承認済み文書",
      status: "validated",
      responsibility: {
        company: "ビーコンメディア",
        department: "統制部",
        section: "コンプライアンス課",
        team: "承認チーム",
        person: "大野",
      },
    },
    publish: {
      id: "publish",
      name: "公開する",
      input: "承認済み文書",
      output: "公開済み文書",
      status: "automatable",
      responsibility: {
        company: "ビーコンメディア",
        department: "基盤部",
        section: "Web課",
        team: "公開チーム",
        person: "山本",
      },
    },
    archive: {
      id: "archive",
      name: "記録を保管する",
      input: "公開済み文書",
      output: "保管記録",
      status: "automatable",
      responsibility: {
        company: "ビーコンメディア",
        department: "基盤部",
        section: "記録管理課",
        team: "保管チーム",
        person: "吉田",
      },
    },
  },
  flows: [
    { from: "draft", to: "doc_review", contract: "下書きが確認可能" },
    { from: "doc_review", to: "revise", contract: "確認結果が修正指示として整理されている" },
    { from: "revise", to: "approve", contract: "修正版が承認申請可能" },
    { from: "approve", to: "publish", contract: "承認済み文書が公開可能" },
    { from: "publish", to: "archive", contract: "公開済み文書を保管できる" },
  ],
  views: [
    { id: "person_view", layout: "lane", boundary: "person", normalForm: "responsibilityBoundary" },
    { id: "team_view", layout: "lane", boundary: "team", normalForm: "responsibilityBoundary" },
    {
      id: "section_view",
      layout: "lane",
      boundary: "section",
      normalForm: "responsibilityBoundary",
    },
    {
      id: "department_view",
      layout: "lane",
      boundary: "department",
      normalForm: "responsibilityBoundary",
    },
    {
      id: "company_view",
      layout: "lane",
      boundary: "company",
      normalForm: "responsibilityBoundary",
    },
  ],
};

const aiAgentExecution: ProcessModel = {
  schemaVersion: "responsible.v0",
  activities: {
    ai_agent_execution: {
      id: "ai_agent_execution",
      name: "AIエージェント実行",
      input: "ユーザー発話",
      output: "アシスタント応答",
      status: "defined",
      children: [
        "user_request",
        "context_collection",
        "planning",
        "tool_execution",
        "verification",
        "response",
      ],
      responsibility: { company: "エージェント基盤" },
    },
    user_request: {
      id: "user_request",
      name: "依頼を受け付ける",
      input: "ユーザー発話",
      output: "解釈済み依頼",
      status: "defined",
      responsibility: {
        company: "エージェント基盤",
        department: "インターフェース部",
        section: "フロントエンド課",
        team: "チャットチーム",
        person: "ゲートウェイ",
      },
    },
    context_collection: {
      id: "context_collection",
      name: "文脈を集める",
      input: "解釈済み依頼",
      output: "文脈",
      status: "defined",
      responsibility: {
        company: "エージェント基盤",
        department: "実行基盤部",
        section: "検索課",
        team: "文脈チーム",
        person: "リトリーバー",
      },
    },
    planning: {
      id: "planning",
      name: "計画する",
      input: "文脈",
      output: "実行計画",
      status: "defined",
      responsibility: {
        company: "エージェント基盤",
        department: "実行基盤部",
        section: "推論課",
        team: "計画チーム",
        person: "プランナー",
      },
    },
    tool_execution: {
      id: "tool_execution",
      name: "ツールを実行する",
      input: "実行計画",
      output: "ツール結果",
      status: "validated",
      responsibility: {
        company: "エージェント基盤",
        department: "実行基盤部",
        section: "実行課",
        team: "ツールチーム",
        person: "エグゼキューター",
      },
    },
    verification: {
      id: "verification",
      name: "結果を検証する",
      input: "ツール結果",
      output: "検証済み結果",
      status: "validated",
      responsibility: {
        company: "エージェント基盤",
        department: "実行基盤部",
        section: "推論課",
        team: "検証チーム",
        person: "ベリファイア",
      },
    },
    response: {
      id: "response",
      name: "応答する",
      input: "検証済み結果",
      output: "アシスタント応答",
      status: "automatable",
      responsibility: {
        company: "エージェント基盤",
        department: "インターフェース部",
        section: "フロントエンド課",
        team: "チャットチーム",
        person: "ゲートウェイ",
      },
    },
  },
  flows: [
    { from: "user_request", to: "context_collection", contract: "依頼が解釈済み" },
    { from: "context_collection", to: "planning", contract: "文脈が組み立て済み" },
    { from: "planning", to: "tool_execution", contract: "実行計画が選択済み" },
    { from: "tool_execution", to: "verification", contract: "ツール結果が取得済み" },
    { from: "verification", to: "response", contract: "検証済み結果に基づいて応答できる" },
  ],
  views: [
    { id: "person_view", layout: "lane", boundary: "person", normalForm: "responsibilityBoundary" },
    { id: "team_view", layout: "lane", boundary: "team", normalForm: "responsibilityBoundary" },
    {
      id: "section_view",
      layout: "lane",
      boundary: "section",
      normalForm: "responsibilityBoundary",
    },
    {
      id: "department_view",
      layout: "lane",
      boundary: "department",
      normalForm: "responsibilityBoundary",
    },
    {
      id: "company_view",
      layout: "lane",
      boundary: "company",
      normalForm: "responsibilityBoundary",
    },
  ],
};

export const sampleProcesses: readonly SampleProcess[] = [
  {
    id: "software_development",
    title: "ソフトウェア開発",
    rootActivityId: "software_development",
    model: softwareDevelopment,
  },
  {
    id: "document_publishing",
    title: "文書公開",
    rootActivityId: "document_publishing",
    model: documentPublishing,
  },
  {
    id: "ai_agent_execution",
    title: "AIエージェント実行",
    rootActivityId: "ai_agent_execution",
    model: aiAgentExecution,
  },
];

export const rootActivityId: Id = sampleProcesses[0]!.rootActivityId;
export const sampleModel: ProcessModel = sampleProcesses[0]!.model;
