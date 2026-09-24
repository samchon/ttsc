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
 * a nearer package that appeared in between (samchon/ttsc#1498). Pass the
 * result to `visitImportMappedCandidates`.
 *
 * The rule is the resolution input recorder's
 * (`RESOLUTION_INPUT_RECORDER_PATH`).
 *
 * @param parent The importer, a path or a file URL.
 * @returns The metadata identity of every search root, by its path, or
 *   `undefined` when the importer is not a file.
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
