import type { ITtscEvidenceGraphClaim } from "./ITtscEvidenceGraphClaim";

/**
 * The root declaration of a project's evidence graph.
 *
 * An evidence graph makes grounds for code and documentation explicit: one side
 * claims to implement, verify, or document something, and the other side is the
 * evidence it must cite with a reason. The configuration defines those
 * boundaries without hardcoding a repository's folder layout or its notion of
 * proof.
 *
 * @evidence contracts/common.md#principled-implementation A graph is represented by independent claims, each carrying its own references, so the type preserves the boundary at which coverage is evaluated.
 * @evidence contracts/common.md#clear-and-simple-design The root holds only the claim collection; population and policy decisions stay in claim and reference types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No repository-specific path, expected coverage result or bypass flag is embedded in this root representation.
 * @evidence contracts/common.md#meaningful-documentation The root and claims comments explain relationship direction, independent coverage and the nonempty-array runtime requirement that TypeScript's array type cannot enforce.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type holds a list of claims and a severity and names no path, file, filesystem or process itself.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no algorithm and performs no computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration coordinates no computation across requests, so there is no result to share.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration owns no retained state, handle or running task.
 */
export interface ITtscEvidenceGraphConfig {
  /**
   * Claim populations whose files must cite their referenced evidence. Each
   * claim owns its reference obligations; coverage is never pooled across
   * claims. Provide at least one claim; an empty array is invalid because it
   * would enable the rule without establishing any evidence obligation.
   */
  claims: ITtscEvidenceGraphClaim[];
}
