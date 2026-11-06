import { E2ETrace } from "../../../internal/E2ETrace";

/**
 * Report actual runtime-cache decisions through the private trace and optional
 * TTSC_EXPLAIN_CACHE stderr output. Explanation never changes build results.
 *
 * @evidence contracts/common.md#principled-implementation Owners supply their computed outcome and refusal reason; reporting observes that decision without redoing proof or changing its result.
 * @evidence contracts/common.md#clear-and-simple-design One reporter shares structured trace fields and opt-in presentation across eligibility, lookup and publication.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No plugin name receives an exception and observation failures cannot manufacture a hit or block the original build.
 * @evidence contracts/common.md#meaningful-documentation The prose states the environment selector, channels and result-preservation contract.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This grouping performs no path or process selection; its fields retain caller-supplied native names.
 * @evidence contracts/performance.md#efficient-algorithms One event and optional line scale with supplied metadata; no input or output tree is traversed.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Reporting observes individual decisions and owns no reusable build authority.
 * @evidence contracts/performance.md#bound-retention-and-release-resources This reporter retains no history; the private trace owner bounds its sink and the invocation owns stderr.
 */
export namespace RuntimeBuildExplanation {
  /**
   * Record one owner-computed decision, retaining ordinary quiet execution.
   *
   * @evidence contracts/common.md#principled-implementation Structured fields preserve project, plugin and reason identity, and only the explicit environment switch enables human output.
   * @evidence contracts/common.md#clear-and-simple-design Trace and presentation consume the same immutable call-local decision.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Reporting catches its own sink failures and never retries or overrides a build.
   * @evidence contracts/common.md#meaningful-documentation The prose describes opt-in behavior and the parameter fields name actual outcomes.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Writing existing stderr and forwarding native path strings requires no platform policy.
   * @evidence contracts/performance.md#efficient-algorithms Serialization scales with the supplied fields and performs no proof work.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A decision event is not reusable proof.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The call retains no event history or handle.
   */
  export function report(decision: {
    /** Actual eligibility, lookup, reuse or publication outcome. */
    outcome: string;
    /** Stable owner-computed reason code, when reuse is unavailable. */
    reason?: string;
    /** Concrete refusal detail, including recoverable native IO errors. */
    detail?: string;
    /** Selected project configuration, when available. */
    project?: string;
    /** Selected plugin whose producer support withheld reuse. */
    plugin?: string;
    /** Selected check or transform stage. */
    stage?: string;
    /** Completed-document content key, when computed. */
    key?: string;
    /** Actual work counters for a completed reuse or publication. */
    outputs?: number;
    /** Outputs individually materialized by this decision. */
    materialized?: number;
  }): void {
    E2ETrace.capabilityResolution("runtime-build-cache", decision);
    if (process.env.TTSC_EXPLAIN_CACHE !== "1") return;
    try {
      process.stderr.write(`ttsx cache: ${JSON.stringify(decision)}\n`);
    } catch {
      /* Explanation cannot change execution. */
    }
  }
}
