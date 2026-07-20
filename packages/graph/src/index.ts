import { spawnSync } from "node:child_process";

import {
  PROJECT_OPTIONS,
  parseLauncherOptions,
  projectOptions,
} from "./launcherArgs";
import { ensureExecutable } from "./nativeExecutable";
import { resolveGraphBinary } from "./resolveGraphBinary";
import { startServer } from "./server/startServer";
import { runView } from "./view";

/** What a graph result says about where its facts came from. */
export {
  RESULT_AUDIT,
  RESULT_AUDIT_DETAILS,
  RESULT_AUDIT_ESCAPE,
  RESULT_AUDIT_SELECTION,
} from "./server/resultAudit";

// Programmatic entry points. Each resolves its native binary from the project
// `cwd` it is given (see `resolveGraphBinary`), so a caller that graphs a
// project other than its own process directory names it once and the binary is
// found under that project's installed `ttsc`.
export { resolveGraphBinary } from "./resolveGraphBinary";
export { loadGraph } from "./model/loadGraph";
export {
  TtscGraphSession,
  type TtscGraphRequestOptions,
  type TtscGraphSessionOptions,
} from "./model/TtscGraphSession";

// The server version reported in the MCP handshake; read from this package.
const VERSION: string = (require("../package.json") as { version: string })
  .version;

const DUMP_OPTIONS = [
  { key: "cwd", flags: ["--cwd", "-cwd"], kind: "value" },
  { key: "tsconfig", flags: ["--tsconfig", "-tsconfig"], kind: "value" },
  { key: "pretty", flags: ["--pretty", "-pretty"], kind: "boolean" },
] as const;

/**
 * Run the `@ttsc/graph` launcher.
 *
 * - `view`: JS-orchestrated 3D viewer (dump -> reduce -> serve -> open).
 * - `dump`: pass through to the native `ttscgraph dump`, which prints the whole
 *   graph as JSON for piping or the viewer.
 * - Default: serve the MCP graph over stdio. The TypeScript server keeps a native
 *   incremental compiler session resident, checks the disk snapshot before each
 *   graph operation, and reuses the in-memory graph when unchanged; the agent's
 *   MCP client speaks JSON-RPC over this process's stdin/stdout.
 */
export function runGraph(
  argv: readonly string[] = process.argv.slice(2),
): number | void {
  if (argv[0] === "view") return runView(argv.slice(1));
  if (argv[0] === "dump") return runDump(argv.slice(1));

  const { cwd, tsconfig } = projectOptions(
    parseLauncherOptions(argv, PROJECT_OPTIONS),
  );
  void startServer({ cwd, tsconfig, version: VERSION }).catch(
    (error: unknown) => {
      process.stderr.write(
        `@ttsc/graph: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exit(1);
    },
  );
}

/**
 * Pass `dump` through to the native binary, inheriting stdio so the JSON lands
 * on this process's stdout. Returns the child's exit code.
 */
function runDump(argv: readonly string[]): number {
  // Resolve the native binary from the target project the caller named with
  // `--cwd`, not from wherever the launcher process happened to start.
  const { cwd } = projectOptions(parseLauncherOptions(argv, DUMP_OPTIONS));
  const binary = resolveGraphBinary(process.env, cwd);
  if (binary === null) {
    process.stderr.write(
      "@ttsc/graph: could not resolve the ttscgraph binary. " +
        "Install `ttsc` so its platform package is present, " +
        "or set TTSC_GRAPH_BINARY to an absolute path.\n",
    );
    return 1;
  }
  ensureExecutable(binary);
  const result = spawnSync(binary, ["dump", ...argv], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    process.stderr.write(`@ttsc/graph: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}
