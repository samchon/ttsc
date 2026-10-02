import { RESOLUTION_INPUT_RECORDER_PATH } from "./RESOLUTION_INPUT_RECORDER_PATH";

/**
 * Whether a module-resolution base is the one a completed resolution selected:
 * the resolved file is the base itself, one of the spellings a resolution
 * probes for it (its `extensions`, its manifest, an index file, a TypeScript
 * source a JavaScript specifier is served from), or lies inside the base as a
 * directory.
 *
 * A bare specifier is looked up in every search root in order
 * (`require.resolve.paths`), and the lookup stops at the first root whose
 * package it selects. Candidates in the roots after that one were never
 * consulted, so they cannot have steered the resolution: their appearance can
 * only matter once the selected package stops resolving, and that package is an
 * input already. A search root below a directory whose metadata churns, such as
 * a home directory or the shared temporary directory, therefore cannot cost a
 * descriptor its cache proof while its package resolves nearer.
 *
 * The rule is the resolution input recorder's
 * (`RESOLUTION_INPUT_RECORDER_PATH`), which every evaluator that records
 * resolution inputs takes it from: the ttsx descriptor evaluator, the isolated
 * CommonJS evaluator, a utility plugin's config loader, and the loader's own
 * candidate expansion and plugin discovery.
 *
 * Every path is compared by its physical spelling, so a package reached through
 * a link is still the one selected. A path that cannot be resolved selects
 * nothing.
 *
 * @param base The candidate base: a package directory, or a path the specifier
 *   names without its extension.
 * @param resolvedFile The file the resolution selected, a path or a file URL,
 *   or `undefined` when it failed.
 * @param extensions The extensions the evaluator's resolution probes.
 *
 * @evidence contracts/common.md#principled-implementation The shared recorder compares the actual selected physical target against a candidate's supported file/directory spellings, stopping candidate observation at the root resolution actually consulted.
 * @evidence contracts/common.md#clear-and-simple-design This typed adapter delegates one selection rule to the shared recorder instead of maintaining separate resolver guesses in each evaluator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The adapter invokes the recorder's exported query without replacing foreign methods or reconstructing a package resolver from guessed target paths.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains stopping semantics, physical identity, unreadable refusal and parameter vocabularies in distinct paragraphs under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The shared rule handles native paths and file URLs with physical identity; callers pass their real extension policy rather than guessing from OS names or splitting only POSIX paths.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources moduleResolutionBaseSelects declares a signature only; the implementation owns acquisition and release of resources.
 * @evidenceExclude contracts/performance.md#efficient-algorithms moduleResolutionBaseSelects declares a signature only; the implementation owns the processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work moduleResolutionBaseSelects declares a signature only; the implementation owns any shared work.
 */
export function moduleResolutionBaseSelects(
  base: string,
  resolvedFile: string | undefined,
  extensions: readonly string[],
): boolean {
  return RECORDER.moduleResolutionBaseSelects(base, resolvedFile, extensions);
}

/** The recorder, loaded once as a module of its own. */
const RECORDER = require(RESOLUTION_INPUT_RECORDER_PATH) as {
  moduleResolutionBaseSelects(
    base: string,
    resolvedFile: string | undefined,
    extensions: readonly string[],
  ): boolean;
};
