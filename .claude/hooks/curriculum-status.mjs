// curriculum-status.mjs — SessionStart hook: orients each session from docs/curriculum.md
// and warns about a missing API key before any exercise run spends money on a failed call.

import { readTasks } from "./lib/curriculum.mjs";
import { addContext, runHook } from "./lib/hook-io.mjs";
import { keyWarning, statusText } from "./lib/status.mjs";

// Each half runs on its own, so a broken curriculum file does not hide the key warning.
const attempt = (what, fn) => {
  try {
    return fn();
  } catch (err) {
    return `curriculum-status could not ${what}: ${err instanceof Error ? err.message : err}`;
  }
};

runHook("curriculum-status", () => {
  // stdin is not read: the event (startup, resume, clear, compact) does not change the report,
  // and a malformed event must not cost the key warning.
  const counts = attempt("read docs/curriculum.md", () => statusText(readTasks()));
  const keyNote = attempt("check the API key", () => keyWarning());
  addContext("SessionStart", [counts, keyNote].filter(Boolean).join("\n"));
});
