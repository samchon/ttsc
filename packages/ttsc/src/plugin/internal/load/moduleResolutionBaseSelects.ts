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
 * Candidate bases require successful native realpath. The selected absolute
 * path or file URL uses realpath when available, but preserves normalized
 * lexical spelling if that query fails. Selection is not an existence or
 * frozen-identity certificate for the completed resolver's selected file.
 *
 * @param base The candidate base: a package directory, or a path the specifier
 *   names without its extension.
 * @param resolvedFile The file the resolution selected, a path or a file URL,
 *   or `undefined` when it failed.
 * @param extensions The extensions the evaluator's resolution probes.
 *
 * @evidence contracts/common.md#principled-implementation The shared recorder compares the completed resolver's selected path against canonical candidate file/directory spellings; selected-path canonicalization can fall back to native lexical spelling, and candidate canonicalization failure refuses that candidate.
 * @evidence contracts/common.md#clear-and-simple-design This typed adapter delegates one selection rule to the shared recorder instead of maintaining separate resolver guesses in each evaluator.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The adapter invokes the recorder's exported query without replacing foreign methods or reconstructing a package resolver from guessed target paths.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains stopping semantics, canonical candidate admission, selected lexical fallback and parameter vocabularies in distinct paragraphs under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The shared rule normalizes native paths/file URLs and canonicalizes candidates; ambiguous folded containment requires native nonzero device/inode agreement. Selected-path realpath failure preserves lexical spelling. Callers supply extension policy without guessing it from OS names or POSIX separators.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Delegated candidate arrays, canonical strings and synchronous metadata are query-local; this adapter retains no selected-path history or acquired handle.
 * @evidence contracts/performance.md#efficient-algorithms Delegation normalizes the selected path/URL, materializes all extension/substitution/manifest/index candidates, then scans until selection. Native realpath/stat, path-text comparisons and possible folded-containment ancestor reconstruction depend on candidate count and native path/topology; one adapter call is not constant-cost.
 * @evidence contracts/performance.md#reuse-equivalent-work The recorder reuses each candidate canonicalization for equality/containment within the query. Its module is loaded once, but mutable filesystem selection is observed per call rather than cached as a cross-request answer.
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
