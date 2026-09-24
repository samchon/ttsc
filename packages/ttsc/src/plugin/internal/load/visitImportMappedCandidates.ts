import { RESOLUTION_INPUT_RECORDER_PATH } from "./RESOLUTION_INPUT_RECORDER_PATH";

/**
 * Visit the candidates of the package a `#` import resolved into, in every
 * search root from the importer up to the one that selected it.
 *
 * A package's `imports` may map a `#` specifier to a bare package, which Node
 * looks up through the ordinary `node_modules` search from the importer. A
 * nearer copy of that package, a nested install or a moved workspace package,
 * would be selected instead, so the candidates the lookup found missing in the
 * nearer roots are inputs of whatever the importer evaluated
 * (samchon/ttsc#1498). The package is named by the resolved module itself, by
 * the directory after its last `node_modules`, or by the linked entry of a
 * search root it lies in, so Node's `imports` algorithm is not copied. A target
 * inside the importer's own package, or one no search root selects, visits
 * nothing.
 *
 * The rule is the resolution input recorder's
 * (`RESOLUTION_INPUT_RECORDER_PATH`).
 *
 * @param parent The importer, a path or a file URL.
 * @param resolved The module the resolution selected, a path or a file URL.
 * @param extensions The extensions the evaluator's resolution probes.
 * @param witnesses What `observeImportSearchRoots` took before the resolution,
 *   or `undefined` when the caller observes nothing itself.
 * @param visit Receives each candidate, and whether its search root moved since
 *   `witnesses`, which leaves the candidate without proof.
 */
export function visitImportMappedCandidates(
  parent: string | undefined,
  resolved: string | undefined,
  extensions: readonly string[],
  witnesses: ReadonlyMap<string, string | undefined> | undefined,
  visit: (file: string, moved: boolean) => void,
): void {
  RECORDER.visitImportMappedCandidates(
    parent,
    resolved,
    extensions,
    witnesses,
    visit,
  );
}

/** The recorder, loaded once as a module of its own. */
const RECORDER = require(RESOLUTION_INPUT_RECORDER_PATH) as {
  visitImportMappedCandidates(
    parent: string | undefined,
    resolved: string | undefined,
    extensions: readonly string[],
    witnesses: ReadonlyMap<string, string | undefined> | undefined,
    visit: (file: string, moved: boolean) => void,
  ): void;
};
