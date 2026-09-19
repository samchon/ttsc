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
 */
export function fseventsBindingPath(): string | null {
  try {
    return createRequire(import.meta.url).resolve("fsevents");
  } catch {
    return null;
  }
}
