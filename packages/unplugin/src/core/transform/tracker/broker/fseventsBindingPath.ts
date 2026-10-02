import { createRequire } from "node:module";

/**
 * Where the `fsevents` binding the watch broker loads on macOS is, or `null`
 * when it cannot be resolved (samchon/ttsc#1425).
 *
 * The binding is an optional dependency of this package, which npm, pnpm, and
 * Yarn install on macOS unless told to skip optional dependencies. It is
 * resolved from this copy of the package, however the host loaded it, since
 * Rollup rewrites `import.meta.url` for the CommonJS and ES module builds
 * alike. The broker's child loads it by this path, and reports every macOS
 * registration failed when there is none, since a watch through `fs.watch`
 * there can lose events without notice.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Package-relative module resolution selects the optional binding installed
 *   with this package; absence returns null rather than an untrusted fallback.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A single resolver boundary returns a path or absence; child startup owns
 *   loading it and reporting unusable registrations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Resolution uses createRequire instead of assumed node_modules layouts or
 *   a fallback watcher whose dropped-event contract cannot supply this proof.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain optional installation, package-relative
 *   resolution and the refusal reason, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral resolution delegates installation layout and path spelling to
 *   the module resolver; native FSEvents loading stays at the macOS boundary.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retains nothing; it returns a path or null.
 * @evidenceExclude contracts/performance.md#efficient-algorithms One module resolution.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Resolved once per broker start; the broker itself is process-wide.
 */
export function fseventsBindingPath(): string | null {
  try {
    return createRequire(import.meta.url).resolve("fsevents");
  } catch {
    return null;
  }
}
