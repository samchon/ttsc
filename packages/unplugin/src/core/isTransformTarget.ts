import { sourceFilePattern } from "./sourceFilePattern";
import { isDeclarationFile } from "./transform/utils/isDeclarationFile";

/** Matches any path segment that is a `node_modules` directory (cross-platform). */
const nodeModulesPattern = /(?:^|[/\\])node_modules(?:[/\\]|$)/;

/**
 * Matches virtual module ids: Rollup/Vite use a leading NUL byte (`\0`) as
 * convention.
 */
const virtualModulePattern = /\0/;

/**
 * Classify whether the supplied module identifier belongs to the transform's
 * TypeScript source syntax. This does not probe native existence or readability.
 *
 * {@link sourceFilePattern} deliberately excludes JavaScript, so a `.js`
 * module reaches no adapter's transform.
 *
 * Also excluded: identifiers containing NUL, declaration basenames, and
 * exact `node_modules` components under either module-id separator spelling.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The shared extension predicate admits TypeScript source, then NUL ids,
 *   declaration basenames and complete node_modules segments are rejected.
 *   Both slash spellings belong to module-id syntax, independent of host OS.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One predicate owns adapter inclusion; declaration classification delegates
 *   to its dedicated helper instead of duplicating suffix policy per host.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   node_modules and virtual identifiers are contractual ownership boundaries,
 *   not fixture paths or consumer names.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain TypeScript-only ownership and exclusions, with
 *   descriptive prose separated from tags per documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Classifies bundler identifier syntax, including both slash spellings,
 *   without deciding native filesystem identity or case policy.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Fixed regular expressions and declaration-basename checks each scan at
 *   most the identifier length. Short-circuit rejection avoids subsequent
 *   scans. Declaration classification additionally allocates normalized text
 *   and extracts its basename; temporary text follows identifier length. No
 *   filesystem lookup or per-call pattern construction occurs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isTransformTarget(id: string): boolean {
  return (
    sourceFilePattern.test(id) &&
    !virtualModulePattern.test(id) &&
    !isDeclarationFile(id) &&
    !nodeModulesPattern.test(id)
  );
}
