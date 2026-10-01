import path from "node:path";

/**
 * Filesystem constants for the performance benchmark runners.
 *
 * Each benchmark package resolves its own roots, so a package that moves takes
 * its work directory with it instead of writing into a sibling's.
 */
export namespace TtscBenchmarkConstant {
  /** Absolute path of the performance benchmark package. */
  export const ROOT = path.resolve(import.meta.dirname, "..");

  /** Default directory for reports and run-local state retained for inspection. */
  export const WORK_ROOT = path.join(ROOT, ".work");

  /** Absolute path of the ttsc repository containing the benchmark package. */
  export const REPOSITORY_ROOT = path.resolve(ROOT, "..", "..");

  /**
   * The repository's TypeScript loader, which compiles the namespaces the
   * harness sources declare on every supported Node (samchon/ttsc#1574).
   */
  export const TYPESCRIPT_LOADER = path.join(
    REPOSITORY_ROOT,
    "config",
    "register-typescript-loader.mjs",
  );
}
