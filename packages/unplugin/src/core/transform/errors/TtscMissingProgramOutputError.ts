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
