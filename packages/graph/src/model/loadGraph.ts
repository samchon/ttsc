import { spawnSync } from "node:child_process";

import { resolveGraphBinary } from "../index";
import { IGraphDump } from "../schema";
import { GraphModel } from "./GraphModel";

/** Where and how to build the graph for a project. */
export interface LoadGraphOptions {
  /** Project root the graph is built for (default: `process.cwd()`). */
  cwd?: string;
  /** Project tsconfig, relative to `cwd` (default: `tsconfig.json`). */
  tsconfig?: string;
  /**
   * Absolute path to the `ttscgraph` binary. Defaults to the per-platform
   * binary resolved from the project's installed `ttsc`, the same one the
   * launcher spawns; pass it explicitly to point at a custom build.
   */
  binary?: string;
}

// A full-project dump is the whole fact graph as one JSON document; a large
// monorepo runs to many megabytes, well past spawnSync's 1 MiB default, so the
// buffer is raised to a ceiling no real graph reaches.
const MAX_DUMP_BYTES = 512 * 1024 * 1024;

/**
 * Build the resident {@link GraphModel} for a project by running `ttscgraph
 * dump` once and loading its JSON. This is the cold path the MCP server takes
 * at startup: one type-check in Go produces the checker-resolved fact graph,
 * then every tool call is answered from the in-memory model.
 *
 * Throws when the binary cannot be resolved, the dump command fails, or its
 * output is not a readable graph — the server surfaces the failure rather than
 * answering from an empty graph.
 */
export function loadGraph(options: LoadGraphOptions = {}): GraphModel {
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
      `@ttsc/graph: ttscgraph dump exited with ${result.status}: ${result.stderr.trim()}`,
    );
  }

  return GraphModel.from(parseDump(result.stdout));
}

/**
 * Parse `ttscgraph dump` output into a graph. Validation is intentionally light
 * here — the Go writer is the trusted producer; the server layer adds a typia
 * assertion once the dump shape is a typed contract there.
 */
export function parseDump(json: string): IGraphDump {
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
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as { nodes?: unknown }).nodes) ||
    !Array.isArray((value as { edges?: unknown }).edges)
  ) {
    throw new Error(
      "@ttsc/graph: dump output is missing its nodes/edges arrays",
    );
  }
  return value as IGraphDump;
}
