import type { IDeclaredPaths } from "./IDeclaredPaths";
import { findDeclaredValue } from "./findDeclaredValue";

/**
 * Locate the nearest `compilerOptions.paths` declaration in the `extends` chain
 * rooted at `tsconfig`. The own config wins over its bases; within an `extends`
 * array, later entries win over earlier ones. `seen` breaks circular chains;
 * the compiler reports the actual config error.
 * Optional decoded sources can be shared only within the caller's current
 * read transaction; physical cycle guards remain branch-local.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The selector accepts a non-array paths record and the shared value reader
 *   supplies nearest-key precedence with its lexical declaring directory.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This adapter owns paths shape and result mapping; inheritance, cycles and
 *   best-effort config access stay with findDeclaredValue.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The shared reader returns the native declaring directory without moving
 *   relative targets to the consumer or guessing a platform package layout.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   It introduces no consumer alias defaults when the declared record is absent.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states own/later-base precedence and the compiler's ownership
 *   of cycle diagnostics, with tags separated from the description.
 * @evidence contracts/performance.md#efficient-algorithms
 *   The fixed shape selector delegates an inheritance search, including native
 *   config resolution, source parsing and branch-local cycle-set copies.
 *   Cost follows visited config occurrences, source bytes and ancestry depth.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The supplied configs map forwards the caller's current decoded-source
 *   transaction to the inheritance reader. No source observation is retained
 *   internally or reused after that caller invalidates the transaction.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function findDeclaredPaths(
  tsconfig: string,
  seen: Set<string>,
  configs?: Map<string, unknown>,
): IDeclaredPaths | null {
  const declared = findDeclaredValue(
    tsconfig,
    (parsed) => {
      const own = (parsed as { compilerOptions?: { paths?: unknown } })
        .compilerOptions?.paths;
      return typeof own === "object" && own !== null && !Array.isArray(own)
        ? (own as Record<string, unknown>)
        : undefined;
    },
    seen,
    undefined,
    configs,
  );
  return declared === null
    ? null
    : { baseDir: declared.baseDir, paths: declared.value };
}
