/**
 * A compile that ended in diagnostics, or in an exception the compiler reported
 * for the project's state: the compiler's verdict on that state, which the same
 * state yields again until an input changes.
 *
 * It is told apart from every other way a delivery can fail, an adapter error
 * before any compile, a generation the adapter could not capture while its
 * inputs kept changing, because a host may keep this verdict as the module's
 * output until its inputs change, the way it keeps a transformed module, while
 * it must not keep those: they say nothing about the state, and only running
 * the module again can answer. A development session under Turbopack delivers
 * this verdict as a module that throws it, and fails the loader run for the
 * others (samchon/ttsc#1458).
 *
 * The message is what the compile reported, as it was before the class existed,
 * so what a host reports is unchanged.
 *
 * @evidence contracts/common.md#principled-implementation A distinct Error subclass represents the compiler's verdict, allowing delivery code to distinguish state-dependent failure from adapter or snapshot acquisition failure without inspecting text.
 * @evidence contracts/common.md#clear-and-simple-design The class adds only typed identity; the compiler message and Error behavior stay native.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No message fragment, fixture name or fabricated successful module determines the failure category.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain which failures this type represents and why hosts may retain this verdict differently from setup failures.
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
export class TtscCompileFailureError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TtscCompileFailureError";
  }
}
