import type { ITtscProjectMembershipPolicy } from "../../tsconfig/ITtscProjectMembershipPolicy";

/** The same question for a bare file name, for callers holding no `Dirent`. */
export function isPossibleProgramFileName(
  name: string,
  policy: ITtscProjectMembershipPolicy,
): boolean {
  const lowered = name.toLowerCase();
  return policy.inputExtensions.some((extension) =>
    lowered.endsWith(extension),
  );
}
