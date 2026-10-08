import type { CapabilityPluginResolver } from "ttsc";

import type { IPublishedArtifacts } from "./IPublishedArtifacts";

/**
 * Publication paired with the exact resolver-owned asynchronous proof. The
 * session releases this proof on replacement or resolver shutdown.
 *
 * @evidence contracts/common.md#principled-implementation The publication inputs remain separate from the exact discovery generation's opaque validity query.
 * @evidence contracts/common.md#clear-and-simple-design Only discovery ownership differs from the synchronous publication data shape.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The original SDK authority supplies currentness rather than a consumer-reconstructed watch list.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies asynchronous proof identity and release ownership.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This data shape selects no computation strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The producing and freshness operations decide whether consumers may reuse it.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The holder must release discovery after replacement; resolver close also drops all retained proofs.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This representation performs no filesystem or process operation.
 */
export interface IPublishedArtifactsResident extends Omit<
  IPublishedArtifacts,
  "discovery"
> {
  /** Owning asynchronous discovery authority, released by the session. */
  discovery: CapabilityPluginResolver.Resolution;
}
