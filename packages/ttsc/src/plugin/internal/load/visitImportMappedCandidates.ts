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
 *
 * @evidence contracts/common.md#principled-implementation The selected target identifies the bare package a hash-import reached; nearer roots' candidates remain inputs and changed pre-resolution root witnesses prevent claiming stable proof.
 * @evidence contracts/common.md#clear-and-simple-design A shared visitor emits candidates through the caller callback instead of duplicating imports resolution or retaining a second candidate population.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual selected targets and supplied probe extensions drive the recorder's exported visitor; this adapter neither modifies Node nor guesses one known package's missing paths.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains selected-root bounds, linked packages, witness timing and the moved flag in separated prose and parameter entries under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native path/file-URL vocabulary and linked physical selection are handled by the shared recorder; this adapter forwards them without slash-only parsing or blanket case conversion.
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
