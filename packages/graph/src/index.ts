import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

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

/** The project root and tsconfig the server was pointed at, mirroring the
 * `--cwd` / `--tsconfig` flags ttscgraph itself parses, so the background
 * diagnostics worker checks the same project. */
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
    else if (arg.startsWith("--tsconfig=")) tsconfig = arg.slice("--tsconfig=".length);
  }
  return { cwd: path.resolve(cwd), tsconfig };
}

/** A `--connect` proxy pipes stdio to a running daemon and serves no graph of
 * its own, so it needs no diagnostics computed locally. */
function isConnectProxy(argv: readonly string[]): boolean {
  return argv.some((a) => a === "--connect" || a.startsWith("--connect="));
}

/**
 * Start the background worker that computes the project's plugin diagnostics
 * (`@ttsc/lint` and transform-plugin findings) and writes them to
 * `diagnosticsFile`, where the server picks them up. Returns the child handle
 * for cleanup, or `null` when it could not be spawned.
 *
 * It runs in parallel with the server so the MCP handshake is never blocked on
 * a compile; the server shows its tsc diagnostics immediately and fuses the
 * plugin findings once the file lands. Any failure is non-fatal — the graph
 * simply stays tsc-only.
 */
function startDiagnosticsWorker(
  argv: readonly string[],
  diagnosticsFile: string,
): ReturnType<typeof spawn> | null {
  try {
    const { cwd, tsconfig } = parseProjectArgs(argv);
    const worker = spawn(
      process.execPath,
      [require.resolve("./diagnostics.js"), cwd, tsconfig, diagnosticsFile],
      { stdio: "ignore", windowsHide: true },
    );
    worker.on("error", () => {
      /* resilient: a worker that cannot start leaves no file */
    });
    worker.unref();
    return worker;
  } catch {
    return null;
  }
}

/**
 * Spawn the resident MCP server, inheriting stdio so the agent's MCP client
 * speaks JSON-RPC to it directly over this process's stdin/stdout. Returns the
 * child's exit code.
 *
 * Before spawning, it kicks off the background diagnostics worker (except in
 * `--connect` proxy mode) and points the server at its output file, so a
 * plugin-using project's lint and transform-plugin diagnostics fuse onto the
 * graph without blocking startup.
 */
export function runGraph(
  argv: readonly string[] = process.argv.slice(2),
): number {
  const binary = resolveGraphBinary();
  if (binary === null) {
    process.stderr.write(
      "@ttsc/graph: could not resolve the ttscgraph binary. " +
        "Install `ttsc` so its platform package is present, " +
        "or set TTSC_GRAPH_BINARY to an absolute path.\n",
    );
    return 1;
  }

  const env: NodeJS.ProcessEnv = { ...process.env };
  let diagnosticsFile: string | null = null;
  let worker: ReturnType<typeof spawn> | null = null;
  if (!isConnectProxy(argv)) {
    diagnosticsFile = path.join(
      os.tmpdir(),
      `ttsc-graph-diagnostics-${process.pid}.json`,
    );
    env.TTSC_GRAPH_DIAGNOSTICS_FILE = diagnosticsFile;
    worker = startDiagnosticsWorker(argv, diagnosticsFile);
  }

  const result = spawnSync(binary, [...argv], {
    stdio: "inherit",
    env,
    windowsHide: true,
  });

  const workerPid = worker?.pid;
  try {
    worker?.kill();
  } catch {
    /* ignore */
  }
  if (diagnosticsFile) {
    try {
      fs.rmSync(diagnosticsFile, { force: true });
    } catch {
      /* ignore */
    }
    // The worker writes atomically through `<file>.<pid>.tmp`; remove a leftover
    // if it was killed mid-write, so a churning daemon does not litter tmpdir.
    if (workerPid !== undefined) {
      try {
        fs.rmSync(`${diagnosticsFile}.${workerPid}.tmp`, { force: true });
      } catch {
        /* ignore */
      }
    }
  }

  if (result.error) {
    process.stderr.write(`@ttsc/graph: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}
