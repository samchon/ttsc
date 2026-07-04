import { spawnSync } from "node:child_process";
import typia from "typia";

import { ensureExecutable } from "../nativeExecutable";
import { resolveGraphBinary } from "../resolveGraphBinary";
import { ITtscGraphDump } from "../structures/ITtscGraphDump";
import { TtscGraphMemory } from "./TtscGraphMemory";

// A full-project dump is the whole fact graph as one JSON document; a large
// monorepo runs to many megabytes, well past spawnSync's 1 MiB default, so the
// buffer is raised to a ceiling no real graph reaches.
const MAX_DUMP_BYTES = 1024 * 1024 * 1024;

/**
 * Build the resident {@link TtscGraphMemory} for a project by running `ttscgraph
 * dump` once and loading its JSON. This is the cold path behind the MCP tool
 * calls: one type-check in Go produces the checker-resolved fact graph, then
 * every later tool call is answered from the in-memory model.
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
  const binary = options.binary ?? resolveGraphBinary();
  if (binary === null) {
    throw new Error(
      "@ttsc/graph: could not resolve the ttscgraph binary. " +
        "Install `ttsc` so its platform package is present, " +
        "or set TTSC_GRAPH_BINARY to an absolute path.",
    );
  }
  ensureExecutable(binary);

  const result = spawnSync(
    binary,
    ["dump", "--cwd", cwd, "--tsconfig", tsconfig],
    { encoding: "utf8", maxBuffer: MAX_DUMP_BYTES, windowsHide: true },
  );
  if (result.error) {
    throw new Error(
      `@ttsc/graph: ttscgraph dump failed: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `@ttsc/graph: ttscgraph dump exited with ${result.status}: ${(result.stderr ?? "").trim()}`,
    );
  }

  return TtscGraphMemory.from(parseDump(result.stdout));
}

/**
 * Parse and validate `ttscgraph dump` output. typia asserts the full
 * {@link ITtscGraphDump} shape so a malformed or stale dump fails loudly here
 * rather than producing wrong answers downstream, and the schema version is
 * checked so an incompatible producer is refused.
 */
function parseDump(json: string): ITtscGraphDump {
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
  return typia.assert<ITtscGraphDump>(value);
}
