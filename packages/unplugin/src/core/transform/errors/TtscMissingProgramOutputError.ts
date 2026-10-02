/**
 * The compile succeeded and produced no output for one requested module,
 * because the program does not contain it.
 *
 * Not a terminal generation error, and deliberately not a build failure. It is
 * a fact about one file, and the answer to it is to leave that file to the host
 * (samchon/ttsc#1308). It is a distinct type rather than a message match so the
 * decision travels as a type: `@ttsc/metro` used to recognise this case by
 * searching the message text for "did not return output", which is how one
 * product came to hold two different answers to one condition.
 *
 * @evidence contracts/common.md#principled-implementation Typed error identity carries the missing-program condition with the requested file, selected config and searched references; consumers can continue without confusing it with compiler failure.
 * @evidence contracts/common.md#clear-and-simple-design One error value packages the context needed to report and route this condition, without adding a retry or compilation layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Classification uses the class rather than a diagnostic substring, and the message names actual configuration inputs rather than test-specific exceptions.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain the continuation policy and the reason for typed classification; field comments identify each diagnostic address.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   An error class that carries a message and fields only; it touches no
 *   filesystem, path or process.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The constructor assigns its fields; constant work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Computes nothing that could be reused.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Retains only the message, cause and fields given to the constructor,
 *   released with the error.
 */
export class TtscMissingProgramOutputError extends Error {
  /** The module the bundler asked for. */
  public readonly file: string;

  /** The project config whose program does not contain it. */
  public readonly tsconfig: string;

  /**
   * The projects its `references` lead to, all searched without one admitting
   * the file (samchon/ttsc#1397).
   */
  public readonly searched: readonly string[];

  public constructor(
    file: string,
    tsconfig: string,
    searched: readonly string[] = [],
  ) {
    super(
      searched.length === 0
        ? `ttsc: ${file} is not part of the program described by ${tsconfig}, so it was left untransformed. Add it to that project's "include" if ttsc plugins should apply to it.`
        : `ttsc: ${file} is not part of the program described by ${tsconfig}, nor of the projects it references (${searched.join(", ")}), so it was left untransformed. Add it to the "include" of the referenced project that should compile it if ttsc plugins should apply to it.`,
    );
    this.name = "TtscMissingProgramOutputError";
    this.file = file;
    this.tsconfig = tsconfig;
    this.searched = searched;
  }
}
