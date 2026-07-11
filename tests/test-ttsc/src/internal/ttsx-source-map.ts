/**
 * Shared helpers for the ttsx source-map regression tests (issue #353).
 *
 * Ttsx runs tsgo-built JavaScript under the original `.ts` source URL. These
 * helpers drive a real ttsx run with Node's built-in V8 coverage recorder
 * (`NODE_V8_COVERAGE`) and read back the coverage JSON, so a test can assert on
 * the two authoritative inputs c8 consumes: the per-script `source-map-cache`
 * entry (its `data` is `null` when the served map dangles) and V8's raw
 * function execution counts. Asserting both decomposes the c8 result exactly —
 * correct counts plus a resolvable map is precisely what turns a false 100%
 * into a faithful per-line report — without depending on c8 itself.
 */
import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * A source module opened by a tall comment block, so emitted lines diverge
 * visibly from source lines, then a called export (`used`) and a never-called
 * export (`unused`). V8 records `unused` with count 0 and `used` with count >
 * 0; with a resolvable map those counts attribute to the right source lines,
 * and without one the run reports a false 100%.
 */
export function tallCommentLibrarySource(): string {
  return [
    "/**",
    " * A tall comment block whose height shifts every statement's line.",
    " *",
    " * padding",
    " * padding",
    " * padding",
    " * padding",
    " * padding",
    " * padding",
    " */",
    "export function used(): string {",
    '  return "used ran";',
    "}",
    "",
    "export function unused(): string {",
    '  return "unused never runs";',
    "}",
    "",
  ].join("\n");
}

/** 1-based source line of the `throw` in {@link tallCommentThrowerSource}. */
export const THROWER_THROW_LINE = 12;
/** 1-based source column of the `new Error(...)` a mapped frame must report. */
export const THROWER_THROW_COLUMN = 9;

/**
 * A never-returning export that throws behind the same tall comment, so the
 * emitted `throw` line differs from the source line. A correctly mapped stack
 * frame reports `THROWER_THROW_LINE:THROWER_THROW_COLUMN` at the real source
 * path.
 */
export function tallCommentThrowerSource(
  functionName: string,
  message: string,
): string {
  return [
    "/**",
    " * A tall comment block whose height shifts every statement's line.",
    " *",
    " * padding",
    " * padding",
    " * padding",
    " * padding",
    " * padding",
    " * padding",
    " */",
    `export function ${functionName}(): never {`,
    `  throw new Error(${JSON.stringify(message)});`,
    "}",
    "",
  ].join("\n");
}

/** One executed script's coverage, joined from the V8 coverage JSON files. */
export interface ScriptCoverage {
  /** The `file://` URL V8 recorded the script under (the `.ts` source URL). */
  url: string;
  /** Whether a `source-map-cache` entry exists for this script at all. */
  hasSourceMapCacheEntry: boolean;
  /**
   * The parsed source map V8 cached, or `null` when the served
   * `sourceMappingURL` could not be resolved (the #353 failure).
   */
  sourceMap: { sources?: unknown; [key: string]: unknown } | null;
  /** V8's per-function execution counts for this script. */
  functions: readonly {
    functionName: string;
    ranges: readonly { count: number }[];
  }[];
}

/** Result of a coverage-instrumented ttsx run. */
export interface CoverageRun {
  status: number | null;
  stdout: string;
  stderr: string;
  /** Coverage for the first executed script whose URL ends with `basename`. */
  scriptEndingWith(basename: string): ScriptCoverage | null;
}

/**
 * Run `ttsx <entry>` under `NODE_V8_COVERAGE` and return the run result plus a
 * reader over the coverage JSON. The coverage directory is a fresh tracked temp
 * dir, so parallel cases never share one another's recordings.
 */
export function runTtsxWithCoverage(
  root: string,
  entry: string,
  env: Record<string, string> = {},
): CoverageRun {
  const coverageDir = TestProject.tmpdir("ttsx-v8-coverage-");
  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, entry],
    { cwd: root, env: { ...env, NODE_V8_COVERAGE: coverageDir } },
  );
  const scripts = readCoverageScripts(coverageDir);
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    scriptEndingWith(basename: string): ScriptCoverage | null {
      const needle = `/${basename}`;
      for (const script of scripts) {
        if (normalizeUrl(script.url).endsWith(needle)) {
          return script;
        }
      }
      return null;
    },
  };
}

/** Highest execution count recorded for the function named `name`, or -1. */
export function maxFunctionCount(script: ScriptCoverage, name: string): number {
  let best = -1;
  for (const fn of script.functions) {
    if (fn.functionName !== name) {
      continue;
    }
    for (const range of fn.ranges) {
      if (range.count > best) {
        best = range.count;
      }
    }
  }
  return best;
}

/**
 * Resolve a source map `sources` entry (an absolute `file://` URL after the
 * #353 fix) to a native filesystem path for comparison against the real
 * source.
 */
export function sourceMapSourcePath(script: ScriptCoverage): string | null {
  const sources = script.sourceMap?.sources;
  if (!Array.isArray(sources) || typeof sources[0] !== "string") {
    return null;
  }
  const first = sources[0];
  return first.startsWith("file:")
    ? path.normalize(fileURLToPath(first))
    : first;
}

interface RawCoverageFile {
  result: readonly {
    url: string;
    functions: readonly {
      functionName: string;
      ranges: readonly { count: number }[];
    }[];
  }[];
  "source-map-cache"?: Record<
    string,
    { data: { sources?: unknown } | null } | undefined
  >;
}

function readCoverageScripts(coverageDir: string): ScriptCoverage[] {
  const byUrl = new Map<string, ScriptCoverage>();
  for (const file of listJsonFiles(coverageDir)) {
    let parsed: RawCoverageFile;
    try {
      parsed = JSON.parse(fs.readFileSync(file, "utf8")) as RawCoverageFile;
    } catch {
      continue;
    }
    const smc = parsed["source-map-cache"] ?? {};
    for (const entry of parsed.result) {
      if (!entry.url.startsWith("file:")) {
        continue;
      }
      // Prefer a record that carries function counts; a later empty duplicate
      // (e.g. the parent process's view) must not clobber the child's real one.
      const existing = byUrl.get(entry.url);
      if (existing !== undefined && existing.functions.length > 0) {
        continue;
      }
      const cache = smc[entry.url];
      byUrl.set(entry.url, {
        url: entry.url,
        hasSourceMapCacheEntry: cache !== undefined,
        sourceMap: cache?.data ?? null,
        functions: entry.functions,
      });
    }
  }
  return [...byUrl.values()];
}

function listJsonFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(dir, name));
}

function normalizeUrl(url: string): string {
  return url.replace(/\\/g, "/");
}
