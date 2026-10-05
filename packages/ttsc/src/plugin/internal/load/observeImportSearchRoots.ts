import { RESOLUTION_INPUT_RECORDER_PATH } from "./RESOLUTION_INPUT_RECORDER_PATH";

/**
 * Fingerprint the search roots a `#` import of `parent` can resolve a bare
 * package through, before the resolution runs.
 *
 * A `#` specifier is looked up in the importer's own package `imports`, which
 * may map it to a bare package that Node then looks up through the ordinary
 * `node_modules` search from the importer. Which package that is can be named
 * only once the resolution selected it, so the candidates of the nearer roots
 * are observed afterwards; each root's own metadata, taken here, is what shows
 * a nearer package that appeared in between. Pass the result to
 * `visitImportMappedCandidates`.
 *
 * The rule is the resolution input recorder's
 * (`RESOLUTION_INPUT_RECORDER_PATH`).
 *
 * @param parent The importer, a path or a file URL.
 * @returns Each search root's metadata witness or unavailable `undefined`, by
 *   native path. Returns `undefined` when the importer is not an absolute path
 *   or convertible file URL; an absolute spelling need not exist.
 * @evidence contracts/common.md#principled-implementation Taking search-root metadata before imports resolution can expose a nearer package that appears before the selected target is known; the later candidate visitor consumes this witness.
 * @evidence contracts/common.md#clear-and-simple-design The adapter returns the shared recorder's pre-resolution witness without duplicating Node's imports mapping or candidate expansion.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This adapter invokes the recorder's exported metadata query without replacing foreign methods or reproducing imports resolution.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains why witnesses precede selection and how the visitor uses them, plus the non-file result; paragraph/tag separation follows the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The recorder accepts native paths or file URLs and observes actual search-root metadata, supporting OS-neutral identity without POSIX-only URL/path conversion in this adapter.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The witness Map transfers to its caller, which owns the resolution-window lifetime; this adapter keeps no history, cache or handle. Delegated synchronous metadata queries retain no open descriptor.
 * @evidence contracts/performance.md#efficient-algorithms Native path/URL normalization and Node search-root construction precede one metadataSignature query per root. Missing branches can walk to existing ancestors, and links incur target stat; complete path/signature text and root/ancestor counts drive query and Map storage costs.
 * @evidence contracts/performance.md#reuse-equivalent-work The returned witness Map is shared with the matching completion visitor rather than replacing its pre-resolution observations with later metadata. Another resolution window obtains fresh witnesses, not a cross-request cached answer.
 */
export function observeImportSearchRoots(
  parent: string | undefined,
): ReadonlyMap<string, string | undefined> | undefined {
  return RECORDER.observeImportSearchRoots(parent);
}

/** The recorder, loaded once as a module of its own. */
const RECORDER = require(RESOLUTION_INPUT_RECORDER_PATH) as {
  observeImportSearchRoots(
    parent: string | undefined,
  ): ReadonlyMap<string, string | undefined> | undefined;
};
