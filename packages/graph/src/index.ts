import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Resolve the per-platform `ttscgraph` MCP server binary, or `null` when it
 * cannot be located.
 *
 * Resolution order:
 *
 * 1. `TTSC_GRAPH_BINARY` env var, when set to an absolute path.
 * 2. The per-platform npm package `@ttsc/<platform>-<arch>/bin/ttscgraph[.exe]`.
 *    That package carries `ttsc`, `ttscserver`, and `ttscgraph` together and is
 *    an `optionalDependency` of `ttsc`, not of this launcher, so it is resolved
 *    from `ttsc`'s location. Resolving from here directly would fail under
 *    pnpm/Yarn-PnP, which link the platform package only into `ttsc`'s tree.
 */
export function resolveGraphBinary(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (env.TTSC_GRAPH_BINARY && path.isAbsolute(env.TTSC_GRAPH_BINARY)) {
    return env.TTSC_GRAPH_BINARY;
  }
  const exe = process.platform === "win32" ? "ttscgraph.exe" : "ttscgraph";
  try {
    const fromTtsc = createRequire(require.resolve("ttsc/package.json"));
    return fromTtsc.resolve(
      `@ttsc/${process.platform}-${process.arch}/bin/${exe}`,
    );
  } catch {
    return null;
  }
}

/**
 * Spawn the resident MCP server, inheriting stdio so the agent's MCP client
 * speaks JSON-RPC to it directly over this process's stdin/stdout. Returns the
 * child's exit code.
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
  const result = spawnSync(binary, [...argv], {
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });
  if (result.error) {
    process.stderr.write(`@ttsc/graph: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}
