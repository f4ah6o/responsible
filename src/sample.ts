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
      name: "Software development",
      input: "RawIssue",
      output: "Release",
      status: "defined",
      children: ["issue_triage", "design", "implementation", "review", "test", "release"],
      responsibility: { company: "Acme Software" },
    },
    issue_triage: {
      id: "issue_triage",
      name: "Issue triage",
      input: "RawIssue",
      output: "TriagedIssue",
      status: "defined",
      responsibility: {
        company: "Acme Software",
        department: "Product",
        section: "Product Management",
        team: "Triage",
        person: "Alice",
      },
    },
    design: {
      id: "design",
      name: "Design",
      input: "TriagedIssue",
      output: "DesignDoc",
      status: "defined",
      responsibility: {
        company: "Acme Software",
        department: "Engineering",
        section: "Architecture",
        team: "Design",
        person: "Bob",
      },
    },
    implementation: {
      id: "implementation",
      name: "Implementation",
      input: "DesignDoc",
      output: "PullRequest",
      status: "defined",
      responsibility: {
        company: "Acme Software",
        department: "Engineering",
        section: "Application",
        team: "Feature",
        person: "Carol",
      },
    },
    review: {
      id: "review",
      name: "Review",
      input: "PullRequest",
      output: "ReviewedPR",
      status: "validated",
      responsibility: {
        company: "Acme Software",
        department: "Engineering",
        section: "Application",
        team: "Feature",
        person: "Dan",
      },
    },
    test: {
      id: "test",
      name: "Test",
      input: "ReviewedPR",
      output: "TestedBuild",
      status: "validated",
      responsibility: {
        company: "Acme Software",
        department: "Quality",
        section: "QA",
        team: "Test",
        person: "Erin",
      },
    },
    release: {
      id: "release",
      name: "Release",
      input: "TestedBuild",
      output: "Release",
      status: "automatable",
      responsibility: {
        company: "Acme Software",
        department: "Platform",
        section: "Release Eng",
        team: "Ops",
        person: "Frank",
      },
    },
  },
  flows: [
    { from: "issue_triage", to: "design", contract: "TriagedIssue is ready for design" },
    { from: "design", to: "implementation", contract: "DesignDoc is accepted" },
    { from: "implementation", to: "review", contract: "PullRequest is opened" },
    { from: "review", to: "test", contract: "ReviewedPR is approved" },
    { from: "test", to: "release", contract: "TestedBuild passes release criteria" },
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
      name: "Document publishing",
      input: "Outline",
      output: "ArchiveRecord",
      status: "defined",
      children: ["draft", "doc_review", "revise", "approve", "publish", "archive"],
      responsibility: { company: "Beacon Media" },
    },
    draft: {
      id: "draft",
      name: "Draft",
      input: "Outline",
      output: "DraftDoc",
      status: "defined",
      responsibility: {
        company: "Beacon Media",
        department: "Authoring",
        section: "Writers",
        team: "Docs",
        person: "Mia",
      },
    },
    doc_review: {
      id: "doc_review",
      name: "Review",
      input: "DraftDoc",
      output: "ReviewedDraft",
      status: "validated",
      responsibility: {
        company: "Beacon Media",
        department: "Authoring",
        section: "Editors",
        team: "Review",
        person: "Noah",
      },
    },
    revise: {
      id: "revise",
      name: "Revise",
      input: "ReviewedDraft",
      output: "RevisedDoc",
      status: "defined",
      responsibility: {
        company: "Beacon Media",
        department: "Authoring",
        section: "Writers",
        team: "Docs",
        person: "Mia",
      },
    },
    approve: {
      id: "approve",
      name: "Approve",
      input: "RevisedDoc",
      output: "ApprovedDoc",
      status: "validated",
      responsibility: {
        company: "Beacon Media",
        department: "Governance",
        section: "Compliance",
        team: "Approval",
        person: "Olivia",
      },
    },
    publish: {
      id: "publish",
      name: "Publish",
      input: "ApprovedDoc",
      output: "PublishedDoc",
      status: "automatable",
      responsibility: {
        company: "Beacon Media",
        department: "Platform",
        section: "Web",
        team: "Publishing",
        person: "Pavel",
      },
    },
    archive: {
      id: "archive",
      name: "Archive",
      input: "PublishedDoc",
      output: "ArchiveRecord",
      status: "automatable",
      responsibility: {
        company: "Beacon Media",
        department: "Platform",
        section: "Records",
        team: "Archive",
        person: "Quinn",
      },
    },
  },
  flows: [
    { from: "draft", to: "doc_review", contract: "DraftDoc is ready for review" },
    { from: "doc_review", to: "revise", contract: "ReviewedDraft has change notes" },
    { from: "revise", to: "approve", contract: "RevisedDoc is submission-ready" },
    { from: "approve", to: "publish", contract: "ApprovedDoc is cleared for release" },
    { from: "publish", to: "archive", contract: "PublishedDoc is live" },
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
      name: "AI agent execution",
      input: "UserMessage",
      output: "AssistantMessage",
      status: "defined",
      children: [
        "user_request",
        "context_collection",
        "planning",
        "tool_execution",
        "verification",
        "response",
      ],
      responsibility: { company: "Agent Platform" },
    },
    user_request: {
      id: "user_request",
      name: "User request",
      input: "UserMessage",
      output: "UserRequest",
      status: "defined",
      responsibility: {
        company: "Agent Platform",
        department: "Interface",
        section: "Frontend",
        team: "Chat",
        person: "Gateway",
      },
    },
    context_collection: {
      id: "context_collection",
      name: "Context collection",
      input: "UserRequest",
      output: "Context",
      status: "defined",
      responsibility: {
        company: "Agent Platform",
        department: "Runtime",
        section: "Retrieval",
        team: "Context",
        person: "Retriever",
      },
    },
    planning: {
      id: "planning",
      name: "Planning",
      input: "Context",
      output: "Plan",
      status: "defined",
      responsibility: {
        company: "Agent Platform",
        department: "Runtime",
        section: "Reasoning",
        team: "Planner",
        person: "Planner",
      },
    },
    tool_execution: {
      id: "tool_execution",
      name: "Tool execution",
      input: "Plan",
      output: "ToolResult",
      status: "validated",
      responsibility: {
        company: "Agent Platform",
        department: "Runtime",
        section: "Execution",
        team: "Tools",
        person: "Executor",
      },
    },
    verification: {
      id: "verification",
      name: "Verification",
      input: "ToolResult",
      output: "VerifiedResult",
      status: "validated",
      responsibility: {
        company: "Agent Platform",
        department: "Runtime",
        section: "Reasoning",
        team: "Verifier",
        person: "Verifier",
      },
    },
    response: {
      id: "response",
      name: "Response",
      input: "VerifiedResult",
      output: "AssistantMessage",
      status: "automatable",
      responsibility: {
        company: "Agent Platform",
        department: "Interface",
        section: "Frontend",
        team: "Chat",
        person: "Gateway",
      },
    },
  },
  flows: [
    { from: "user_request", to: "context_collection", contract: "UserRequest is parsed" },
    { from: "context_collection", to: "planning", contract: "Context is assembled" },
    { from: "planning", to: "tool_execution", contract: "Plan is selected" },
    { from: "tool_execution", to: "verification", contract: "ToolResult is captured" },
    { from: "verification", to: "response", contract: "VerifiedResult is grounded" },
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
    title: "Software development",
    rootActivityId: "software_development",
    model: softwareDevelopment,
  },
  {
    id: "document_publishing",
    title: "Document publishing",
    rootActivityId: "document_publishing",
    model: documentPublishing,
  },
  {
    id: "ai_agent_execution",
    title: "AI agent execution",
    rootActivityId: "ai_agent_execution",
    model: aiAgentExecution,
  },
];

export const rootActivityId: Id = sampleProcesses[0]!.rootActivityId;
export const sampleModel: ProcessModel = sampleProcesses[0]!.model;
