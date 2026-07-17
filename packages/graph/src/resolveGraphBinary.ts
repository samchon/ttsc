import { createRequire } from "node:module";
import path from "node:path";

/**
 * Resolve the per-platform `ttscgraph` binary, or `null` when it cannot be
 * located.
 *
 * `ttsc` is a peer dependency pinned to this package's own version, installed
 * alongside `@ttsc/graph` in the user's project rather than nested under this
 * launcher, so resolution starts from the user's project, not from this
 * package's own tree.
 *
 * The pin is what keeps the two halves of the graph in step. `literals` and the
 * rest of the node facts are resolved by the Go builder and ride the dump, so a
 * newer `@ttsc/graph` reading an older `ttscgraph` would find those fields
 * simply absent and answer from a graph missing facts it believes are there.
 *
 * Resolution order:
 *
 * 1. `TTSC_GRAPH_BINARY` env var, when set to an absolute path.
 * 2. The per-platform npm package `@ttsc/<platform>-<arch>/bin/ttscgraph[.exe]`.
 *    That package carries `ttsc`, `ttscserver`, and `ttscgraph` together and is
 *    an `optionalDependency` of `ttsc`, so it is resolved from `ttsc`'s
 *    location — found from `cwd`, the project the caller selected (via `--cwd`
 *    or an API `cwd` option), defaulting to `process.cwd()` when no project was
 *    named. A launcher started from an unrelated directory still resolves the
 *    `ttsc` installed under the target project it was asked to graph.
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
    // Anchor package lookup at the absolute project root so a relative `--cwd`
    // resolves the same way the native process interprets it.
    const ttscPackageJson = require.resolve("ttsc/package.json", {
      paths: [path.resolve(cwd)],
    });
    const fromTtsc = createRequire(ttscPackageJson);
    return fromTtsc.resolve(
      `@ttsc/${process.platform}-${process.arch}/bin/${exe}`,
    );
  } catch {
    return null;
  }
}
