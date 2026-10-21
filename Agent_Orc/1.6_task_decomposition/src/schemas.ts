// schemas.ts — the review contract: one system prompt and the three output schemas.
//
// Every pass gets the same reviewer instructions. Single-pass and local-pass even share
// the per-file shape, so the only thing that differs between the two approaches is how
// much code sits in one context. That is the variable this exercise measures.
//
// The schemas go to the API as structured outputs (output_config.format), so the model's
// answer is guaranteed to parse and to have this shape. Structured outputs accept a subset
// of JSON Schema: every object closes with additionalProperties: false and lists every
// property in required; no minItems, maxItems or pattern. Rules the schema cannot express
// (bug_count equals the number of issues, an integration issue names 2+ files) are checked in code.

/** Shared by every pass, single-pass and multi-pass alike. */
export const REVIEWER_SYSTEM: string = [
  "You are a senior TypeScript reviewer.",
  "Report real bugs only: code that behaves wrongly at runtime, is unsafe, or breaks a caller.",
  "Do not report style, naming or missing comments.",
  "Each finding cites the exact line number from the numbered listing you were given.",
  "Severity is one of critical, high, medium, low.",
].join("\n");

const SEVERITY = { type: "string", enum: ["critical", "high", "medium", "low"] };

const ISSUE = {
  type: "object",
  additionalProperties: false,
  required: ["line", "severity", "description"],
  properties: {
    line: { type: "integer", description: "Line number from the numbered listing." },
    severity: SEVERITY,
    description: { type: "string", description: "What is wrong and what it causes at runtime." },
  },
};

const FILE_NAME = { type: "string", description: "The file name exactly as in its === FILE header." };
// Redundant with issues.length on purpose: local-pass.ts checks the two agree.
const BUG_COUNT = { type: "integer", description: "The number of entries in issues." };
const ISSUES = { type: "array", items: ISSUE, description: "One entry per bug; empty when the file is clean." };

/** Single-pass: one entry per file, the same per-file shape as a local review. */
export const SINGLE_PASS_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["files"],
  properties: {
    files: {
      type: "array",
      description: "One entry per file reviewed, in the order given.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["file", "bug_count", "issues"],
        properties: { file: FILE_NAME, bug_count: BUG_COUNT, issues: ISSUES },
      },
    },
  },
};

// The local review also records the file's interface: what it exports and what it calls.
// These facts are what the integration pass reasons over in place of raw source.
const EXPORT_FACT = {
  type: "object",
  additionalProperties: false,
  required: ["signature", "behaviour"],
  properties: {
    signature: { type: "string", description: "The exported function's TypeScript signature." },
    behaviour: {
      type: "string",
      description: "What a caller must know: units of the result, and what happens when nothing is found (null, throw, empty).",
    },
  },
};

const CALL_FACT = {
  type: "object",
  additionalProperties: false,
  required: ["line", "callee", "arguments", "expects"],
  properties: {
    line: { type: "integer", description: "Line number of the call in the numbered listing." },
    callee: { type: "string", description: "The imported function called, with the module it comes from." },
    arguments: { type: "string", description: "The arguments passed, in order, as written." },
    expects: {
      type: "string",
      description: "What this caller assumes about the result: units, and whether a miss is null or a throw.",
    },
  },
};

/** Local pass: one file's review plus its interface facts. This is the per-file summary. */
export const LOCAL_PASS_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["file", "bug_count", "issues", "exports", "calls"],
  properties: {
    file: FILE_NAME,
    bug_count: BUG_COUNT,
    issues: ISSUES,
    exports: { type: "array", items: EXPORT_FACT, description: "Every exported function of this file." },
    calls: { type: "array", items: CALL_FACT, description: "Every call this file makes into another module of the repo." },
  },
};

/** Integration pass: only issues that span two or more files. */
export const INTEGRATION_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["issues"],
  properties: {
    issues: {
      type: "array",
      description: "Cross-file issues only; a bug inside one file belongs to the local pass.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "files", "description"],
        properties: {
          category: {
            type: "string",
            enum: ["data_flow", "api_consistency", "pattern_consistency"],
            description:
              "data_flow: a value changes meaning between files (units, null vs throw). " +
              "api_consistency: a call does not match the callee's signature. " +
              "pattern_consistency: the same job done differently across files.",
          },
          files: { type: "array", items: { type: "string" }, description: "Every file involved, two or more." },
          description: { type: "string", description: "The mismatch, citing the call line and the export it breaks." },
        },
      },
    },
  },
};
