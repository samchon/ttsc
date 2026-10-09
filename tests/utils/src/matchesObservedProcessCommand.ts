/**
 * Compare a process listing with one selected executable and argument vector.
 *
 * POSIX ps prints the command without shell quoting. Windows listings may quote
 * the executable when its path contains spaces. This observer compares the
 * complete displayed command; comm/name truncation supplies no authority. The
 * caller separately binds the original generation, parent and source key.
 *
 * @evidence contracts/common.md#principled-implementation Full command equality binds the selected executable and every argument; executable quoting is the explicit Windows representation difference. Process names and basename prefixes never authorize a match.
 * @evidence contracts/common.md#clear-and-simple-design One predicate owns displayed-command comparison while callers own original process generation and source admission.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No fixture identity or fuzzy basename exception grants admission; only the selected complete command representations match.
 * @evidence contracts/common.md#meaningful-documentation Describes displayed quoting and the independent generation/parent/source authority the caller must retain.
 * @evidence contracts/portability.md#os-neutral-implementation The caller supplies the observed host platform. POSIX ps and Windows CIM display differ at executable quoting; path spelling remains exact and is not case-folded from an OS name.
 * @evidence contracts/performance.md#efficient-algorithms Joining and comparing the selected argument bytes takes linear time and temporary space in their total length.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each comparison concerns one current process snapshot and selected argument vector, without sharing an effectful operation or historical result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The predicate owns no process, native lifetime, filesystem resource or retained state.
 */
export function matchesObservedProcessCommand(
  command: string | null,
  argv: readonly string[],
  platform: NodeJS.Platform,
): boolean {
  if (command === null || argv.length === 0) return false;
  if (command === argv.join(" ")) return true;
  return (
    platform === "win32" &&
    command === [`"${argv[0]}"`, ...argv.slice(1)].join(" ")
  );
}
