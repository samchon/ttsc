/**
 * A compile that ended in diagnostics, or in an exception the compiler reported
 * during the project attempt. Hosts distinguish this compiler-reported failure
 * from errors in adapter setup or snapshot acquisition.
 *
 * It is told apart from every other way a delivery can fail, an adapter error
 * before any compile, a generation the adapter could not capture while its
 * inputs kept changing, because a host may keep this verdict as the module's
 * output until its inputs change, the way it keeps a transformed module, while
 * it must not keep those: they say nothing about the state, and only running
 * the module again can answer. A development session under Turbopack delivers
 * this verdict as a module that throws it, and fails the loader run for the
 * others.
 *
 * The message retains the compiler's rendered diagnostics or exception. The
 * type does not assert that arbitrary plugin exceptions are deterministic;
 * retry and retention authority belong to the host's declared pass lifecycle.
 *
 * @evidence contracts/common.md#principled-implementation A distinct Error subclass represents the compiler-reported verdict, allowing delivery code to distinguish its origin from adapter or snapshot acquisition failure without inspecting text or asserting deterministic exception behavior.
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
 *   Adds no independent cache, handle or running task; the supplied message
 *   and native Error data follow the caller-owned error object's lifetime.
 */
export class TtscCompileFailureError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TtscCompileFailureError";
  }
}
