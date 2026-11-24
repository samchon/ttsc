import path from "node:path";

/**
 * Separate the upstream compiler's `--listFiles` answer from the rest of one
 * run's standard output.
 *
 * The compiler prints each Program file on a line of its own as an absolute
 * path, the same shape `--listFilesOnly` prints and the watch topology already
 * reads. A diagnostic line never is a bare absolute path: it carries a
 * position, a category and a code, and its continuation lines are indented.
 *
 * @evidence contracts/common.md#principled-implementation The compiler's own list is read as printed, with the same absolute-line rule the topology's listing uses, so both sources agree on membership.
 * @evidence contracts/common.md#clear-and-simple-design One pure split returns the list and the remaining text; callers decide whether the list stays displayed.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No file is inferred: only lines the compiler printed become members, and an empty list is returned as empty for the caller to treat as unavailable.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the printed shape and why diagnostic lines cannot match it.
 * @evidence contracts/portability.md#os-neutral-implementation path.isAbsolute and path.resolve interpret the compiler's spelling natively, turning forward slashes into the platform separator on Windows.
 * @evidence contracts/performance.md#efficient-algorithms One pass over the output lines; storage follows the output size.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure split of one run's text shares nothing across runs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned arrays and text transfer to the caller; nothing is retained.
 */
export namespace CompilerProgramFiles {
  /**
   * Split one run's standard output into its listed Program files and the
   * remaining text, line endings of the remaining lines preserved.
   *
   * @param stdout Standard output of a `tsc -p <config> --listFiles` run.
   * @returns The listed files, resolved, and the output without their lines.
   * @evidence contracts/common.md#principled-implementation Only bare absolute-path lines are taken, exactly as listCompilerInputs takes them from `--listFilesOnly`.
   * @evidence contracts/common.md#clear-and-simple-design One loop builds both results.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Lines are not filtered by extension or existence; the compiler's answer stands as printed.
   * @evidence contracts/common.md#meaningful-documentation The parameter and result describe the expected run and both outputs.
   * @evidence contracts/portability.md#os-neutral-implementation Native path functions decide absoluteness and spelling.
   * @evidence contracts/performance.md#efficient-algorithms Linear in output lines.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A pure function of its input.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Call-local arrays only.
   */
  export function split(stdout: string): { files: string[]; rest: string } {
    const files: string[] = [];
    const rest: string[] = [];
    for (const line of stdout.split(/(?<=\n)/)) {
      const trimmed = line.trim();
      if (trimmed.length !== 0 && path.isAbsolute(trimmed))
        files.push(path.resolve(trimmed));
      else rest.push(line);
    }
    return { files, rest: rest.join("") };
  }
}
