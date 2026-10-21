// types.ts — shapes shared by the passes, the answer key and the report

/** One file from the directory under review, in the fixed order every pass uses. */
export interface SourceFile {
  /** 1-based position in review order. Dilution is about position, so it is kept explicit. */
  position: number;
  /** File name, e.g. "02_product-repo.ts". Every pass and the answer key key on this. */
  name: string;
  path: string;
  lines: number;
  text: string;
}

export type Severity = "critical" | "high" | "medium" | "low";

/** One finding inside one file. */
export interface Issue {
  line: number;
  severity: Severity;
  description: string;
}

/** A review of one file: the shape both approaches return, so they compare like for like. */
export interface FileReview {
  file: string;
  bug_count: number;
  issues: Issue[];
}

/** A function the file exports, as the local pass describes it. */
export interface InterfaceFact {
  signature: string;
  /** What a caller must know: units of the result, what happens when nothing is found. */
  behaviour: string;
}

/** A call this file makes into another module, as the local pass describes it. */
export interface CrossModuleCall {
  line: number;
  callee: string;
  arguments: string;
  /** What this caller assumes about the result: units, throw vs null. */
  expects: string;
}

/**
 * The local pass's output: the per-file review plus the interface facts.
 * This object is the per-file summary the integration pass reads instead of raw source.
 */
export interface LocalReview extends FileReview {
  exports: InterfaceFact[];
  calls: CrossModuleCall[];
}

export type CrossFileCategory = "data_flow" | "api_consistency" | "pattern_consistency";

/** One issue the integration pass found between files. */
export interface CrossFileIssue {
  category: CrossFileCategory;
  files: string[];
  description: string;
}

/** A bug planted in sample-repo, from the answer key. */
export interface SeededIssue {
  id: string;
  kind: "local" | "cross_file";
  file: string;
  line: number;
  /** Text the seeded line must contain: proves the key still matches the repo. */
  snippet: string;
  /** cross_file only: the module whose contract the call site in `file` breaks. */
  partner?: string;
  description: string;
}

/** The same code in two or more files: a fair reviewer gives every site the same verdict. */
export interface IdenticalPattern {
  pattern: string;
  sites: { file: string; line: number }[];
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
}

/** One model call, kept for the run totals and the call-count check. */
export interface CallStats {
  tag: string;
  usage: Usage;
  ms: number;
}
