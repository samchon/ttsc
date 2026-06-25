import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

import { startServer } from "./server/serve";
import { runView } from "./view";

// The server version reported in the MCP handshake; read from this package.
const VERSION: string = (require("../package.json") as { version: string })
  .version;

/**
 * Resolve the per-platform `ttscgraph` MCP server binary, or `null` when it
 * cannot be located.
 *
 * `ttsc` is a peer the user installs alongside `@ttsc/graph` (not a dependency
 * of this launcher), so resolution starts from the user's project, not from
 * this package's own tree.
 *
 * Resolution order:
 *
 * 1. `TTSC_GRAPH_BINARY` env var, when set to an absolute path.
 * 2. The per-platform npm package `@ttsc/<platform>-<arch>/bin/ttscgraph[.exe]`.
 *    That package carries `ttsc`, `ttscserver`, and `ttscgraph` together and is
 *    an `optionalDependency` of `ttsc`, so it is resolved from `ttsc`'s
 *    location — found from `process.cwd()` (the project where the agent ran the
 *    server).
 */
export function resolveGraphBinary(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string | null {
  if (env.TTSC_GRAPH_BINARY && path.isAbsolute(env.TTSC_GRAPH_BINARY)) {
    return env.TTSC_GRAPH_BINARY;
  }
  const exe = process.platform === "win32" ? "ttscgraph.exe" : "ttscgraph";
  try {
    const ttscPackageJson = require.resolve("ttsc/package.json", {
      paths: [cwd],
    });
    const fromTtsc = createRequire(ttscPackageJson);
    return fromTtsc.resolve(
      `@ttsc/${process.platform}-${process.arch}/bin/${exe}`,
    );
  } catch {
    return null;
  }
}

/**
 * The project root and tsconfig to build the graph for, from the `--cwd` /
 * `--tsconfig` flags (the same ones `ttscgraph dump` accepts). Defaults are the
 * process working directory and `tsconfig.json`.
 */
function parseProjectArgs(argv: readonly string[]): {
  cwd: string;
  tsconfig: string;
} {
  let cwd = process.cwd();
  let tsconfig = "tsconfig.json";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--cwd" && i + 1 < argv.length) cwd = argv[++i]!;
    else if (arg.startsWith("--cwd=")) cwd = arg.slice("--cwd=".length);
    else if (arg === "--tsconfig" && i + 1 < argv.length) tsconfig = argv[++i]!;
    else if (arg.startsWith("--tsconfig="))
      tsconfig = arg.slice("--tsconfig=".length);
  }
  return { cwd: path.resolve(cwd), tsconfig };
}

/**
 * Run the `@ttsc/graph` launcher.
 *
 * - `view`: JS-orchestrated 3D viewer (dump -> reduce -> serve -> open).
 * - `dump`: pass through to the native `ttscgraph dump`, which prints the whole
 *   graph as JSON for piping or the viewer.
 * - Default: serve the MCP graph over stdio. The TypeScript server runs
 *   `ttscgraph dump` once to build the resident graph, then answers tool calls
 *   from memory; the agent's MCP client speaks JSON-RPC over this process's
 *   stdin/stdout. The process stays alive on the stdio transport.
 */
export function runGraph(
  argv: readonly string[] = process.argv.slice(2),
): number | void {
  if (argv[0] === "view") return runView(argv.slice(1));
  if (argv[0] === "dump") return runDump(argv);

  const { cwd, tsconfig } = parseProjectArgs(argv);
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
  const binary = resolveGraphBinary();
  if (binary === null) {
    process.stderr.write(
      "@ttsc/graph: could not resolve the ttscgraph binary. " +
        "Install `ttsc` so its platform package is present, " +
        "or set TTSC_GRAPH_BINARY to an absolute path.\n",
    );
    return 1;
  }
  const result = spawnSync(binary, [...argv], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    process.stderr.write(`@ttsc/graph: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}
