import { compilerUsesCaseSensitiveFileNames } from "ttsc/tsconfig";

import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";

/**
 * Whether a membership policy matches root specs case-sensitively.
 *
 * A supplied compiler answer wins, including false. Before a report is
 * available, compilerUsesCaseSensitiveFileNames approximates the answer from
 * the policy root's plugin-cache location, or the current directory when that
 * root is unknown. That physical-root proxy does not observe the executable
 * and can disagree under different directory capabilities or native spelling
 * mappings. Capture replaces it with an available report and refuses a walk
 * primed under a different answer before retrying.
 *
 * @param policy The membership policy.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A supplied policy wins; an absent answer delegates to the shared native
 *   cache-root approximation. The wrapper does not certify that proxy as the
 *   executable's actual comparison rule.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One resolver owns reported-versus-predicted precedence for root matching.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   A supplied compiler flag governs matching, independently of native path
 *   grammar. The fallback delegates actual cache-root selection and probing to
 *   compilerUsesCaseSensitiveFileNames, including its documented platform and
 *   proxy limitations; no source-directory OS label establishes case policy.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The shared approximation remains explicitly provisional; a later differing
 *   envelope is handled by the generation owner rather than hidden.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose distinguishes supplied and approximate answers, unknown-root
 *   fallback and report-driven retry, with the policy argument documented.
 * @evidence contracts/performance.md#efficient-algorithms
 *   A supplied boolean returns immediately. The fallback retains native cache
 *   placement costs: default discovery may visit ancestors and manifest/layout
 *   entries before root setup and lookup, even for an already cached probe.
 *   This wrapper adds no input scan or secondary collection.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Supplied policy data needs no probe. Fallback sharing belongs to the shared
 *   predictor's physical-root cache; placement/setup still repeat before its
 *   lookup and historical answers do not independently prove current capability.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
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
