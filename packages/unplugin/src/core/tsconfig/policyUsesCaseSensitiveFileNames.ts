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
 *
 * @evidence contracts/common.md#principled-implementation
 *   A compiler-reported policy wins; before a report the host derives the same
 *   rule from the selected compiler executable rather than the source OS name.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One resolver owns reported-versus-predicted precedence for root matching.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The compiler envelope supplies its comparison capability; before compilation
 *   the shared host queries the executable's filesystem rule, not the OS name.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   No OS-wide case guess substitutes for the compiler's actual rule; a later
 *   differing envelope is handled by the generation owner rather than hidden.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs identify whose case rule matters and why a compiler
 *   replacement can require retry, with the policy argument documented.
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
