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
 */
export class TtscCompileFailureError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "TtscCompileFailureError";
  }
}
