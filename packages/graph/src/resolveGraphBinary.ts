import { InstalledGraphBinary } from "./internal/InstalledGraphBinary";

/**
 * Resolve the `ttscgraph` binary this `@ttsc/graph` release spawns, or `null`
 * when it cannot be located.
 *
 * The binary ships in `@ttsc/graph-<platform>-<arch>`, which `@ttsc/graph`
 * lists as an exact-version optional dependency, so it is resolved from this
 * package's own installation. The JavaScript client and the native producer
 * therefore always come from one release, wherever the launcher was started.
 * That pairing matters because node facts such as `literals` are resolved by
 * the producer and ride the dump: a client reading an older producer would find
 * those fields absent and answer from a graph missing facts it believes are
 * there.
 *
 * Resolution order:
 *
 * 1. `TTSC_GRAPH_BINARY` env var, when set to an absolute path.
 * 2. `@ttsc/graph-<platform>-<arch>/bin/ttscgraph[.exe]`, resolved from the
 *    installed `@ttsc/graph` package.
 *
 * `cwd` is still accepted so existing callers keep compiling. It no longer
 * affects resolution: the binary used to come from the target project's `ttsc`
 * platform package, and now belongs to `@ttsc/graph` itself.
 *
 * @evidence contracts/common.md#principled-implementation The installed-package resolver locates the exact-version platform dependency from this module's own location; an explicit absolute override has precedence.
 * @evidence contracts/common.md#clear-and-simple-design The public function delegates to the one resolver every launcher, loader and session uses, anchored at this package's installation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Resolution uses the installed package contract rather than repository layouts or the target project's packages.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs and the ordered list explain package ownership, override precedence and the retained but ignored cwd argument.
 * @evidence contracts/portability.md#os-neutral-implementation The delegated resolver selects the platform/architecture package through Node module resolution; only Windows's executable suffix differs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources returns a path string and opens no handle.
 * @evidenceExclude contracts/performance.md#efficient-algorithms performs at most one module resolution.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work resolves on every call and caches nothing, so a reinstall between calls is honored.
 */
export function resolveGraphBinary(
  env: NodeJS.ProcessEnv = process.env,
  cwd?: string,
): string | null {
  void cwd;
  return InstalledGraphBinary.resolve(env, __filename);
}
