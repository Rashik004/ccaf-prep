// log.ts — the run log every exercise writes.
//
// Two sinks:
//   file   — always written, never silenced, never truncated. Holds the readable
//            trace plus the full JSON of everything handed to record() or
//            stream(): prompts as sent, responses as received, usage, cost.
//   stderr — the readable trace, kept off stdout so the program's own result can
//            be redirected to a file cleanly.
//
// Env (all optional):
//   DEBUG_TRACE=0        quiet stderr: headlines only (the file stays complete)
//   DEBUG_TRACE_MAX=n    truncate quoted text on stderr at n chars
//   DEBUG_RAW=1          echo raw dumps on stderr as well
//   RUN_LOG_FILE=path    write here instead of <exercise>/Log/<stamp>_run.log

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fileStamp } from "./stamp";

export const RULE = "─".repeat(72);

export interface RunLogOptions {
  /** Exact log file path. Default: RUN_LOG_FILE, else <exerciseRoot>/Log/<stamp>_run.log. */
  file?: string;
  /** Headlines only on stderr. Default: DEBUG_TRACE=0. */
  quiet?: boolean;
  /** Truncate quoted text on stderr beyond this many chars. Default: DEBUG_TRACE_MAX. */
  quoteMax?: number;
  /** Echo raw dumps on stderr. Default: DEBUG_RAW=1. */
  raw?: boolean;
  /** Where stderr lines go. Tests swap it. Default: console.error. */
  stderr?: (line: string) => void;
}

export interface RunLog {
  readonly file: string;
  /** File only. */
  toFile(text: string): void;
  /** stderr (unless quiet) and file. */
  out(line: string): void;
  /** stderr always and file: the minimum needed to follow a run. */
  headline(line: string): void;
  /** Indented block. Full text to file; stderr truncated at quoteMax. */
  quote(text: string): void;
  /** Full JSON of a request, a response or any payload, under a label. File only. */
  record(label: string, payload: unknown): void;
  /** record() for the n-th message of a streamed session. */
  stream(seq: number, message: unknown): void;
  /** Raw text dump between markers: file always, stderr only with raw on. */
  dump(title: string, body: string): void;
  /** Opening block: the run title plus labelled fields. */
  banner(title: string, fields: Record<string, string | undefined>): void;
  /** Closing block: one summary line. */
  finished(summary: string): void;
  /** Last thing written before a non-zero exit. */
  runError(err: unknown): void;
}

/**
 * Opens the run log for one exercise. `exerciseRoot` is the folder holding
 * `src/` and `Log/`, usually `new URL("../", import.meta.url)` from inside src/.
 * Nothing is written until the first line, so a dry import leaves no file behind.
 */
export function openRunLog(exerciseRoot: string | URL, options: RunLogOptions = {}): RunLog {
  const file =
    options.file ??
    (process.env.RUN_LOG_FILE ? resolve(process.env.RUN_LOG_FILE) : defaultLogPath(exerciseRoot));
  const quiet = options.quiet ?? process.env.DEBUG_TRACE === "0";
  const quoteMax = options.quoteMax ?? (Number(process.env.DEBUG_TRACE_MAX ?? 0) || undefined);
  const raw = options.raw ?? process.env.DEBUG_RAW === "1";
  const stderr = options.stderr ?? ((line: string) => console.error(line));

  let fileReady = false;
  let fileBroken = false;

  /** Appends synchronously: the process may exit(1) at any point and must not lose the tail. */
  function toFile(text: string) {
    if (fileBroken) return;
    try {
      if (!fileReady) {
        mkdirSync(dirname(file), { recursive: true });
        fileReady = true;
      }
      appendFileSync(file, `${text}\n`, "utf8");
    } catch (err) {
      fileBroken = true; // a logging failure is reported, and the run continues
      stderr(`[log] file sink disabled (${(err as Error).message})`);
    }
  }

  function out(line: string) {
    if (!quiet) stderr(line);
    toFile(line);
  }

  function headline(line: string) {
    stderr(line);
    toFile(line);
  }

  function quote(text: string) {
    toFile(quoteLines(text));
    if (quiet) return;
    const shown =
      quoteMax && text.length > quoteMax
        ? `${text.slice(0, quoteMax)}\n…[${text.length - quoteMax} more chars; full text in ${file}]`
        : text;
    stderr(quoteLines(shown));
  }

  function record(label: string, payload: unknown) {
    toFile(`\n===== ${label} =====`);
    toFile(safeJson(payload));
  }

  function stream(seq: number, message: unknown) {
    const m = message as { type?: string; subtype?: string };
    record(`stream[${seq}] type=${m.type ?? "?"}${m.subtype ? ` subtype=${m.subtype}` : ""}`, message);
  }

  function dump(title: string, body: string) {
    const block = `\n=== ${title} ===\n${body}\n=== END ===`;
    toFile(block);
    if (raw) stderr(block);
  }

  function banner(title: string, fields: Record<string, string | undefined>) {
    headline(`\n${RULE}`);
    headline(`▶ RUN  ${title}`);
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) headline(`       ${key}: ${value}`);
    }
    headline(`       log file: ${file}`);
    out(`       stderr trace: ${quiet ? "headlines only (DEBUG_TRACE=0)" : "on (DEBUG_TRACE=0 to quiet)"}`);
    headline(RULE);
  }

  function finished(summary: string) {
    headline(`\n${RULE}`);
    headline(`■ ${summary}`);
    headline(RULE);
  }

  function runError(err: unknown) {
    headline(`\n${RULE}`);
    headline(`■ RUN FAILED — ${err instanceof Error ? err.message : String(err)}`);
    if (err instanceof Error && err.stack) toFile(err.stack);
    headline(RULE);
  }

  return { file, toFile, out, headline, quote, record, stream, dump, banner, finished, runError };
}

// --- helpers ---------------------------------------------------------------

function defaultLogPath(exerciseRoot: string | URL): string {
  const root = typeof exerciseRoot === "string" ? exerciseRoot : fileURLToPath(exerciseRoot);
  return resolve(root, "Log", `${fileStamp()}_run.log`);
}

function quoteLines(text: string): string {
  return text
    .split("\n")
    .map((l) => `   > ${l}`)
    .join("\n");
}

/** First non-empty line of a text, shortened: for one-line headlines. */
export function gist(text: string, max = 100): string {
  const first = text.trim().split("\n").find((l) => l.trim()) ?? "";
  return first.length > max ? `${first.slice(0, max - 1)}…` : first;
}

/** JSON.stringify that survives circular references and unserialisable values. */
export function safeJson(value: unknown): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (_k, v) => {
        if (typeof v === "object" && v !== null) {
          if (seen.has(v as object)) return "[circular]";
          seen.add(v as object);
        }
        return v;
      },
      2
    );
  } catch (err) {
    return `[unserialisable: ${(err as Error).message}]`;
  }
}
