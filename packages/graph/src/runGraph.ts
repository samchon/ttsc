import { spawnSync } from "node:child_process";

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

/** The help spellings `ttscgraph` itself accepts, mirrored for the fallback. */
const DUMP_HELP_FLAGS = new Set(["--help", "-help", "-h"]);

/**
 * Print a `dump` usage summary when the native binary cannot be resolved.
 *
 * This is a fallback, not a second contract: `cmd/ttscgraph/main.go` owns these
 * flags and answers whenever it is installed. Keep this short and point at that
 * authority, so a drift degrades to a stale summary rather than a wrong
 * answer.
 */
function printDumpHelp(): void {
  process.stdout.write(
    [
      "Usage: ttsc-graph dump [options]",
      "",
      "Write the whole compiler graph as JSON to stdout: every node and edge,",
      "none of the MCP response caps.",
      "",
      "Options:",
      "  --cwd <dir>        Project root (default: current directory).",
      "  --tsconfig <path>  Project tsconfig path (default: tsconfig.json).",
      "  --pretty           Indent the JSON output.",
      "",
      "The native `ttscgraph` binary owns these flags and is not installed here,",
      "so this summary may lag it. Install `ttsc` and rerun for the exact list.",
      "",
    ].join("\n"),
  );
}

/**
 * Pass `dump` through to the native binary, inheriting stdio so the JSON lands
 * on this process's stdout. Returns the child's exit code.
 */
function runDump(argv: readonly string[]): number {
  // Resolve the native binary from the target project the caller named with
  // `--cwd`, not from wherever the launcher process happened to start.
  const { cwd, tsconfig } = TtscGraphLauncherArguments.dump(argv);
  const binary = resolveGraphBinary(process.env, cwd);
  if (binary === null) {
    // `ttscgraph` owns the flag contract, so a resolvable binary always answers
    // `--help` itself and stays the single source of truth. It cannot answer
    // when it is absent, and that is exactly when a caller is most likely to be
    // asking what the command needs — so fall back to a summary that names the
    // authority rather than making usage unreachable behind an install error.
    if (argv.some((argument) => DUMP_HELP_FLAGS.has(argument))) {
      printDumpHelp();
      return 0;
    }
    process.stderr.write(
      "@ttsc/graph: could not resolve the ttscgraph binary. " +
        "Install `ttsc` so its platform package is present, " +
        "or set TTSC_GRAPH_BINARY to an absolute path.\n",
    );
    return 1;
  }
  ensureExecutable(binary);
  // The same artifacts `loadGraph` and the resident session ask for, so the
  // three ways to reach a dump answer a citation the same way. A caller that
  // named `--artifacts` itself owns the answer and is not overridden.
  const published = argv.includes("--artifacts")
    ? null
    : publishArtifacts({ cwd, tsconfig });
  const result = spawnSync(
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
