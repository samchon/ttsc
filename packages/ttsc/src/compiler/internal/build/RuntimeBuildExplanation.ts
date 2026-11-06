import fs from "node:fs";

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
   * @evidence contracts/common.md#principled-implementation Structured fields preserve project, plugin and reason identity; opt-in output writes the existing stderr descriptor synchronously so a closed reader fails inside this owner's catch instead of emitting an unhandled asynchronous stream error.
   * @evidence contracts/common.md#clear-and-simple-design Trace and presentation consume the same immutable call-local decision.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Reporting catches its own sink failures without adding error listeners to the process stream, retrying or overriding a build.
   * @evidence contracts/common.md#meaningful-documentation The prose describes opt-in behavior and the parameter fields name actual outcomes.
   * @evidence contracts/portability.md#os-neutral-implementation Node's synchronous descriptor write owns native pipe/terminal/file behavior and propagates failures within the call; descriptor 2 is the existing stderr channel on every supported host.
   * @evidence contracts/performance.md#efficient-algorithms Serialization and opt-in synchronous output scale with supplied metadata; disabled reporting performs no sink IO and no proof work is repeated.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A decision event is not reusable proof.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The call borrows descriptor 2 without closing it, retaining a stream listener or queueing an asynchronous write; the caller owns its supplied metadata.
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
      fs.writeFileSync(2, `ttsx cache: ${JSON.stringify(decision)}\n`);
    } catch {
      /* Explanation cannot change execution. */
    }
  }
}
