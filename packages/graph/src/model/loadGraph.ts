import { spawnSync } from "node:child_process";
import typia from "typia";

import { captureProcessOutput, ensureExecutable } from "../nativeExecutable";
import { resolveGraphBinary } from "../resolveGraphBinary";
import { ITtscGraphDump } from "../structures/ITtscGraphDump";
import { TtscGraphMemory } from "./TtscGraphMemory";

/**
 * The dump schema version this client reads.
 *
 * Keep it equal to `DumpSchemaVersion` in
 * `packages/ttsc/internal/graph/provenance.go`. The two are hand-synchronized,
 * and `dump_schema_version_matches_the_typescript_client_test.go` reads this
 * constant out of this file and fails if the pair drifts.
 *
 * Exported because the resident session reads the same dump body over the serve
 * protocol and has to hold it to the same number: the envelope's version and
 * the body's are independent, so a producer can speak this protocol and still
 * send a body from another schema.
 *
 * `scripts/assert-ttscgraph-release-candidate.cjs` reads this declaration out
 * of this file with a regular expression, because it runs against a packaged
 * binary in a workflow that has no reason to have built this package first.
 * Rewriting the declaration — adding a type annotation, splitting the line —
 * makes that script fail loudly rather than silently, and its message names
 * this constant; update its pattern with any such change.
 */
export const DUMP_SCHEMA_VERSION = 7;

/**
 * Build the resident {@link TtscGraphMemory} for a project by running `ttscgraph
 * dump` once and loading its JSON. This is the one-shot path for direct callers
 * and the viewer. The MCP server uses `TtscGraphSession` instead so source
 * edits refresh a resident compiler session.
 *
 * Throws when the binary cannot be resolved, the dump command fails, or its
 * output is not a readable graph — the server surfaces the failure rather than
 * answering from an empty graph.
 */
export function loadGraph(
  options: {
    /** Project root the graph is built for (default: `process.cwd()`). */
    cwd?: string;
    /** Project tsconfig, relative to `cwd` (default: `tsconfig.json`). */
    tsconfig?: string;
    /**
     * Absolute path to the `ttscgraph` binary. Defaults to the per-platform
     * binary resolved from the project's installed `ttsc`; pass it explicitly
     * to point at a custom build.
     */
    binary?: string;
  } = {},
): TtscGraphMemory {
  const cwd = options.cwd ?? process.cwd();
  const tsconfig = options.tsconfig ?? "tsconfig.json";
  // Resolve the platform binary from the selected project cwd, not the caller's
  // process directory, so a one-shot load names its own installation.
  const binary = options.binary ?? resolveGraphBinary(process.env, cwd);
  if (binary === null) {
    throw new Error(
      "@ttsc/graph: could not resolve the ttscgraph binary. " +
        "Install `ttsc` so its platform package is present, " +
        "or set TTSC_GRAPH_BINARY to an absolute path.",
    );
  }
  ensureExecutable(binary);

  // The dump goes to a file rather than a pipe, so no output ceiling applies:
  // a graph is as large as the repository is, and any limit named here would be
  // a guess about someone else's monorepo. See `captureProcessOutput`.
  const capture = captureProcessOutput();
  let result;
  let stdout: string;
  let stderr: string;
  try {
    result = spawnSync(binary, ["dump", "--cwd", cwd, "--tsconfig", tsconfig], {
      stdio: ["ignore", capture.stdoutFd, capture.stderrFd],
      windowsHide: true,
    });
    stdout = capture.read("stdout");
    stderr = capture.read("stderr");
  } finally {
    capture.dispose();
  }
  if (result.error) {
    throw new Error(
      `@ttsc/graph: ttscgraph dump failed: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `@ttsc/graph: ttscgraph dump exited with ${result.status}: ${stderr.trim()}`,
    );
  }

  return TtscGraphMemory.from(parseDump(stdout));
}

/**
 * Parse and validate `ttscgraph dump` output. typia asserts the full
 * {@link ITtscGraphDump} shape so a malformed or stale dump fails loudly here
 * rather than producing wrong answers downstream, and the schema version is
 * checked so an incompatible producer is refused.
 *
 * The version is read before the shape: a dump from another schema is entitled
 * to another shape, so asserting first would report the mismatch as a field
 * complaint about a contract that producer never agreed to. A dump also
 * outlives the process that wrote it — this is the one-shot path, and the JSON
 * on disk may be from any build — so the version is the first question to ask
 * of it.
 */
export function parseDump(json: string): ITtscGraphDump {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    throw new Error(
      `@ttsc/graph: dump output is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const version: number | undefined = typia.is<{
    provenance: { schemaVersion: number };
  }>(value)
    ? value.provenance.schemaVersion
    : undefined;
  if (version !== DUMP_SCHEMA_VERSION) {
    throw new Error(
      `@ttsc/graph: ttscgraph dump is schema ${
        version === undefined ? "unknown" : `v${String(version)}`
      }, this client reads v${String(DUMP_SCHEMA_VERSION)}. ` +
        "Install a matching `ttsc` (the binary resolves from the target " +
        "project, or from TTSC_GRAPH_BINARY).",
    );
  }
  try {
    return typia.assert<ITtscGraphDump>(value);
  } catch (error) {
    throw new Error(
      `@ttsc/graph: dump output does not match schema v${String(
        DUMP_SCHEMA_VERSION,
      )}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
