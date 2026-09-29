import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

/**
 * Whether a bare filename has an extension admitted by the project policy.
 *
 * @evidence contracts/common.md#principled-implementation Case-normalized suffix matching applies the policy's admitted extension list; this is an eligibility approximation, not filesystem path identity.
 * @evidence contracts/common.md#clear-and-simple-design One lowercased name and an early-terminating suffix scan represent the extension rule without performing filesystem work.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The predicate uses compiler-derived extension policy rather than selected test filenames or bundler output-directory exceptions.
 * @evidence contracts/common.md#meaningful-documentation The native comment states the bare-name input and policy boundary, avoiding an ambiguous reference to another helper's question.
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
