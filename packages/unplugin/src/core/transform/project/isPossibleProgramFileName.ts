import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

/**
 * Whether a bare filename has an extension admitted by the project policy.
 *
 * @evidence contracts/common.md#principled-implementation Case-normalized suffix matching applies the policy's admitted extension list; this is an eligibility approximation, not filesystem path identity.
 * @evidence contracts/common.md#clear-and-simple-design One lowercased name and an early-terminating suffix scan represent the extension rule without performing filesystem work.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The predicate uses compiler-derived extension policy rather than selected test filenames or bundler output-directory exceptions.
 * @evidence contracts/common.md#meaningful-documentation The native comment states the bare-name input and policy boundary, avoiding an ambiguous reference to another helper's question.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Compares a lowercased basename suffix with the policy's extensions; it reads no filesystem.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Lowercasing scans the filename and allocates its normalized text once.
 *   The early-terminating scan checks the supplied extension population, with
 *   suffix comparison cost following the extension text. No filename or
 *   extension index is rebuilt inside the scan.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function isPossibleProgramFileName(
  name: string,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  const lowered = name.toLowerCase();
  return policy.inputExtensions.some((extension) =>
    lowered.endsWith(extension),
  );
}
