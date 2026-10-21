// dilution.ts — Step 6: the same code at two positions should get the same verdict.
// Identical code deserves identical verdicts; a difference is attention dilution,
// not a judgment about the code. Reported, never asserted: a strong model on small
// files may not show it, and that is a valid result.

import { IDENTICAL_PATTERNS, flaggedAt } from "./answer-key";
import { logObservation } from "./log";
import type { FileReview, IdenticalPattern, LocalReview } from "./types";

const NO_KEY = "n/a (no answer key for this directory)";

/** One line per approach: each site flagged or approved, then ARTEFACT or consistent. */
function verdictLine(label: string, pattern: IdenticalPattern, reviews: FileReview[]): { text: string; artefact: boolean } {
  const verdicts = pattern.sites.map((site) => flaggedAt(site, reviews));
  const artefact = verdicts.some((v) => v !== verdicts[0]);
  const sites = pattern.sites.map((s, i) => `${s.file}:${s.line} ${verdicts[i] ? "flagged" : "approved"}`);
  return { text: `    ${label.padEnd(12)}${sites.join("; ")} -> ${artefact ? "ARTEFACT" : "consistent"}`, artefact };
}

/** Section "Attention dilution artefacts": single-pass against multi-pass on the identical-code probe. */
export function dilutionReport(single: FileReview[], local: LocalReview[], keyApplies: boolean): string {
  const title = "Attention dilution artefacts";
  if (!keyApplies) return `${title}\n  ${NO_KEY}`;

  const lines = [title];
  let singleArtefact = false;
  let multiArtefact = false;
  for (const pattern of IDENTICAL_PATTERNS) {
    const s = verdictLine("single-pass", pattern, single);
    const m = verdictLine("multi-pass", pattern, local);
    singleArtefact = singleArtefact || s.artefact;
    multiArtefact = multiArtefact || m.artefact;
    lines.push(`  pattern: ${pattern.pattern}`, s.text, m.text);
  }

  const observed = (flag: boolean) => (flag ? "observed" : "not observed");
  const singleLine = `dilution artefact single-pass: ${observed(singleArtefact)}`;
  const multiLine = `dilution artefact multi-pass: ${observed(multiArtefact)}`;
  logObservation(singleLine);
  logObservation(multiLine);
  lines.push("", `  ${singleLine}`, `  ${multiLine}`);
  return lines.join("\n");
}
