import {
  isResponsibilityBoundaryNormalForm,
  projectByResponsibilityBoundary,
  type ProcessModel,
  type ViewDef,
} from "../src/index.js";

const model = {
  schemaVersion: "responsible.v0",
  activities: {
    receive_inquiry: {
      id: "receive_inquiry",
      input: "Inquiry",
      output: "EstimateRequest",
      responsibility: {
        section: "sales_section",
        department: "sales_department",
        company: "example_construction",
        function: "sales",
        role: "sales_rep",
        system: "mail",
      },
    },
    create_estimate: {
      id: "create_estimate",
      input: "EstimateRequest",
      output: "Estimate",
      responsibility: {
        section: "estimation_section",
        department: "sales_department",
        company: "example_construction",
        function: "sales",
        role: "estimator",
        system: "spreadsheet",
      },
    },
    approve_estimate: {
      id: "approve_estimate",
      input: "Estimate",
      output: "ApprovedEstimate",
      responsibility: {
        section: "sales_section",
        department: "sales_department",
        company: "example_construction",
        function: "sales",
        role: "approver",
        system: "workflow",
      },
    },
    create_work_plan: {
      id: "create_work_plan",
      input: "ApprovedEstimate",
      output: "WorkPlan",
      responsibility: {
        section: "construction_section",
        department: "construction_department",
        company: "example_construction",
        function: "construction",
        role: "planner",
        system: "spreadsheet",
      },
    },
  },
  flows: [
    { from: "receive_inquiry", to: "create_estimate" },
    { from: "create_estimate", to: "approve_estimate" },
    { from: "approve_estimate", to: "create_work_plan" },
  ],
} satisfies ProcessModel;

const departmentView = {
  id: "department_view",
  layout: "lane",
  boundary: "department",
  normalForm: "responsibilityBoundary",
} satisfies ViewDef;

const projected = projectByResponsibilityBoundary(model, departmentView);

console.log(JSON.stringify(projected, null, 2));
console.log("RBNF:", isResponsibilityBoundaryNormalForm(projected));
