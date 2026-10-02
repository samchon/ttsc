import { GraphProcessTrace } from "./internal/GraphProcessTrace";

import { TtscGraphLauncherArguments } from "./TtscGraphLauncherArguments";
import { publishArtifacts } from "./model/publishedArtifacts";
import { ensureExecutable } from "./nativeExecutable";
import { resolveGraphBinary } from "./resolveGraphBinary";
import { startServer } from "./server/startServer";
import { runView } from "./view";

// The server version reported in the MCP handshake; read from this package.
const VERSION: string = (require("../package.json") as { version: string })
  .version;

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
 *
 * @evidence contracts/common.md#principled-implementation The first command token selects view, native dump or stdio MCP; shared project parsing supplies the producer coordinates consistently.
 * @evidence contracts/common.md#clear-and-simple-design The launcher owns lane dispatch while viewer, server and native dump helpers own their respective execution boundaries.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing dump binary exposes only an explicitly qualified help summary; execution failures retain nonzero outcomes instead of fake graph answers.
 * @evidence contracts/common.md#meaningful-documentation Native lane bullets explain observable CLI behavior and resident refresh ownership with a blank line before tags.
 * @evidence contracts/portability.md#os-neutral-implementation Native lanes resolve the selected project's platform package and pass argv directly; stdio MCP uses Node transport APIs without shell path construction.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources starts the stdio server (owned by startServer), runs a synchronous dump child to completion or hands over to runView, and keeps no handle itself.
 * @evidenceExclude contracts/performance.md#efficient-algorithms dispatches on the first argv token to one lane and the lanes own the work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work runs one launcher lane per process invocation, so there is nothing to share.
 */
export function runGraph(
  argv: readonly string[] = process.argv.slice(2),
): number | void {
  if (argv[0] === "view") return runView(argv.slice(1));
  if (argv[0] === "dump") return runDump(argv.slice(1));

  const { cwd, tsconfig } = TtscGraphLauncherArguments.project(argv);
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
  const { cwd, tsconfig, artifactsSpecified } = TtscGraphLauncherArguments.dump(argv);
  const binary = resolveGraphBinary(process.env, cwd);
  if (binary === null) {
    // `ttscgraph` owns the flag contract, so a resolvable binary always answers
    // `--help` itself and stays the single source of truth. It cannot answer
    // when it is absent, and that is exactly when a caller is most likely to be
    // asking what the command needs — so fall back to a summary that names the
    // authority rather than making usage unreachable behind an install error.
    const fallback = TtscGraphLauncherArguments.missingDump(argv);
    if (fallback.stdout !== undefined) process.stdout.write(fallback.stdout);
    if (fallback.stderr !== undefined) process.stderr.write(fallback.stderr);
    return fallback.code;
  }
  ensureExecutable(binary);
  // The same artifacts `loadGraph` and the resident session ask for, so the
  // three ways to reach a dump answer a citation the same way. A caller that
  // named `--artifacts` itself owns the answer and is not overridden.
  const published = artifactsSpecified
    ? null
    : publishArtifacts({ cwd, tsconfig });
  const result = GraphProcessTrace.spawnSync(
    binary,
    TtscGraphLauncherArguments.dumpVector(argv, published?.file ?? null),
    {
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const completion = TtscGraphLauncherArguments.dumpCompletion(result);
  if (completion.diagnostic !== undefined)
    process.stderr.write(completion.diagnostic);
  return completion.code;
}
