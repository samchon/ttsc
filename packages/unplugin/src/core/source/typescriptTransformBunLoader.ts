import { TYPESCRIPT_TRANSFORM_SOURCES } from "./TYPESCRIPT_TRANSFORM_SOURCES";

/**
 * Select Bun's parser for an exact TypeScript transform source.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Exact suffix matching selects the loader attached to an accepted extension
 *   in the shared table; absent matches remain undefined rather than guessing.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The source table owns extension-to-parser policy and this helper only queries it.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Returned ts/tsx names are Bun protocol values from the maintained contract,
 *   with no separate adapter-specific extension list.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies exact-source parser selection; the optional result
 *   and blank tag separation preserve documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Scans the small fixed table of TypeScript source extensions once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function typescriptTransformBunLoader(
  filePath: string,
): "ts" | "tsx" | undefined {
  return TYPESCRIPT_TRANSFORM_SOURCES.find(({ extension }) =>
    filePath.endsWith(extension),
  )?.bunLoader;
}
