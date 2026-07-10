import type { CardDeck, ResponsibilityFields } from "./cardDeck.js";

// Starter deck reproducing the leaves of the bundled `application_approval`
// responsible.v1 sample (src/sample.ts) — the issue-#42 acceptance case: a
// card deck whose conversion passes the existing validator and projection and
// matches the sample's activities and flows.

const YAMADA: ResponsibilityFields = {
  company: "あおい商事",
  department: "営業部",
  section: "営業一課",
  team: "見積チーム",
  person: "山田",
};
const TANAKA: ResponsibilityFields = {
  company: "あおい商事",
  department: "管理部",
  section: "審査課",
  team: "審査チーム",
  person: "田中",
};
const SUZUKI: ResponsibilityFields = {
  company: "あおい商事",
  department: "管理部",
  section: "審査課",
  team: "承認チーム",
  person: "鈴木",
};
const SATO: ResponsibilityFields = {
  company: "あおい商事",
  department: "総務部",
  section: "文書課",
  team: "記録チーム",
  person: "佐藤",
};

export function sampleDeck(): CardDeck {
  return {
    version: "responsible.card-deck.v1",
    title: "申請承認",
    cards: [
      {
        id: "draft_application",
        kind: "activity",
        title: "申請書を作成する",
        input: "顧客要望",
        output: "申請書ドラフト",
        responsibility: YAMADA,
        status: "defined",
        requires: ["顧客要望が確定している"],
        ensures: ["Application.status = draft"],
        effects: [],
        outcomes: [],
        position: { x: 0, y: 0 },
      },
      {
        id: "submit_application",
        kind: "activity",
        title: "申請を提出する",
        input: "申請書ドラフト",
        output: "提出済み申請",
        responsibility: YAMADA,
        status: "defined",
        requires: ["Application.status = draft", "必須項目が記入済み"],
        ensures: ["Application.status = submitted", "SubmissionFact(Application, 山田) = true"],
        effects: [
          {
            id: "effect-1",
            payloadKind: "command",
            schema: "ApprovalRequest",
            mode: "directed",
            target: TANAKA,
          },
        ],
        outcomes: [],
        position: { x: 260, y: 80 },
      },
      {
        id: "review_application",
        kind: "activity",
        title: "申請を審査する",
        input: "提出済み申請",
        output: "審査済み申請",
        responsibility: TANAKA,
        status: "defined",
        requires: ["Application.status = submitted"],
        ensures: ["Application.status = reviewed"],
        effects: [
          {
            id: "effect-1",
            payloadKind: "data",
            schema: "ReviewNote",
            mode: "directed",
            target: SUZUKI,
          },
        ],
        outcomes: [],
        position: { x: 520, y: 160 },
      },
      {
        id: "approve_application",
        kind: "activity",
        title: "申請を承認する",
        input: "審査済み申請",
        output: "承認済み申請",
        responsibility: SUZUKI,
        status: "defined",
        requires: ["Application.status = reviewed", "ApprovalAuthority(鈴木, Application) = true"],
        ensures: ["Application.status = approved", "ApprovalFact(Application, 鈴木) = true"],
        effects: [
          {
            id: "effect-1",
            payloadKind: "domain-fact",
            schema: "ApprovalResult",
            mode: "directed",
            target: YAMADA,
          },
          {
            id: "effect-2",
            payloadKind: "domain-fact",
            schema: "ApprovalFact",
            mode: "broadcast",
            target: {},
          },
        ],
        outcomes: [],
        position: { x: 780, y: 240 },
      },
      {
        id: "archive_application",
        kind: "activity",
        title: "申請を保管する",
        input: "承認済み申請",
        output: "保管済み申請",
        responsibility: SATO,
        status: "defined",
        requires: ["Application.status = approved"],
        ensures: ["Application.archived = true"],
        effects: [],
        outcomes: [],
        position: { x: 1040, y: 320 },
      },
    ],
    connections: [
      {
        id: "flow-1",
        from: "draft_application",
        to: "submit_application",
        contract: "ドラフトを提出できる",
      },
      {
        id: "flow-2",
        from: "submit_application",
        to: "review_application",
        contract: "提出済み申請を審査できる",
      },
      {
        id: "flow-3",
        from: "review_application",
        to: "approve_application",
        contract: "審査結果で承認判断できる",
      },
      {
        id: "flow-4",
        from: "approve_application",
        to: "archive_application",
        contract: "承認済み申請を保管できる",
      },
    ],
    laneHints: [
      { id: "lane-1", label: "営業（山田）", responsibility: YAMADA },
      { id: "lane-2", label: "審査（田中）", responsibility: TANAKA },
      { id: "lane-3", label: "承認（鈴木）", responsibility: SUZUKI },
      { id: "lane-4", label: "記録（佐藤）", responsibility: SATO },
    ],
  };
}
