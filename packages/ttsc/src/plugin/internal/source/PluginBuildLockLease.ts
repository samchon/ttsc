/**
 * Ownership token returned only to the process that acquired the v3 lock.
 *
 * Produced by {@link acquirePluginBuildLock} and consumed by
 * {@link releasePluginBuildLock}. Release retires this generation and no other,
 * so a holder whose lock was reclaimed cannot release its successor. The token
 * remains valid only in its original coordination namespace.
 *
 * Its completion nonce authorizes the acquiring process to record actual task
 * completion after its payload callback has ended, including an already retired
 * generation. Expiring a wait budget does not end that callback.
 *
 * @evidence contracts/common.md#principled-implementation The protocol and random generation identify the holder's retirement destination; a separate nonce qualifies its actual task-completion witness, without representing legacy or old v2 acquisition.
 * @evidence contracts/common.md#clear-and-simple-design The token carries ownership identity while acquisition, finally release and tombstone collection own the lifecycle decisions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Release uses the recorded generation rather than deleting whichever holder currently occupies a shared pathname.
 * @evidence contracts/common.md#meaningful-documentation Native prose names producer, consumer, protocol and namespace lifetime; properties have separate useful comments without checklist tags.
 * @evidence contracts/portability.md#os-neutral-implementation The generation is protocol spelling independent of native separators; the v3 discriminant isolates the filesystem namespace from old v2 reclaimers.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export type PluginBuildLockLease = {
  /** Always "v3": acquisition never grants an older protocol's ownership. */
  protocol: "v3";

  /** The 128-bit hex id of the held generation. */
  generation: string;

  /** The acquiring task's 128-bit completion publication capability. */
  completionNonce: string;
};
