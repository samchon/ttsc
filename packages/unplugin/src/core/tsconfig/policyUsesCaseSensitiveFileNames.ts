import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";

/**
 * Whether a membership policy matches root specs case-sensitively.
 *
 * The compiler's own answer, reported by its envelope, decides
 * (samchon/ttsc#1545). A policy no compile has reported for yet takes the
 * answer that compiler will give, which TypeScript-Go takes from the executable
 * it runs as, and ttsc answers before it runs by the same rule
 * (`compilerUsesCaseSensitiveFileNames`, samchon/ttsc#1563). The project is the
 * policy's config directory, whose cache root holds that executable. A report
 * that still disagrees, as from a compiler replaced after this answer, is
 * retried under the reported policy (`captureTransformGeneration`).
 *
 * @param policy The membership policy.
 */
export function policyUsesCaseSensitiveFileNames(
  policy: ITtscProjectMembershipPolicy,
): boolean {
  return (
    policy.useCaseSensitiveFileNames ??
    compilerUsesCaseSensitiveFileNames({
      projectRoot: policy.rootFileSpecs?.root?.path ?? process.cwd(),
    })
  );
}
