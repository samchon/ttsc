import path from "node:path";
import { pathToFileURL } from "node:url";

/** Filesystem and Node execution constants for the graph benchmark runners. */
export namespace TtscBenchmarkConstant {
  /** Absolute path of the graph benchmark package. */
  export const ROOT = path.resolve(import.meta.dirname, "..");

  /** Default directory for reports and run-local state retained for inspection. */
  export const WORK_ROOT = path.join(ROOT, ".work");

  /** Directory containing the tool-neutral graph benchmark prompt corpus. */
  export const QUESTIONS_ROOT = path.join(ROOT, "assets", "questions");

  /** Absolute path of the ttsc repository containing the benchmark package. */
  export const REPOSITORY_ROOT = path.resolve(ROOT, "..", "..");

  /**
   * The repository's TypeScript loader, which compiles the namespaces these
   * harness sources declare on every supported Node (samchon/ttsc#1574).
   */
  export const TYPESCRIPT_LOADER = path.join(
    REPOSITORY_ROOT,
    "config",
    "register-typescript-loader.mjs",
  );

  /**
   * Builds Node arguments that execute a TypeScript entrypoint through the
   * repository's TypeScript loader.
   */
  export function nodeTypeScriptArguments(
    script: string,
    arguments_: readonly string[] = [],
  ): string[] {
    return [
      "--experimental-strip-types",
      "--import",
      pathToFileURL(TYPESCRIPT_LOADER).href,
      script,
      ...arguments_,
    ];
  }
}
