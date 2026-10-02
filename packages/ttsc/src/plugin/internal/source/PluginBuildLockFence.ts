/**
 * Opaque identity of one observed lock generation.
 *
 * Returned by {@link inspectPluginBuildLock} and consumed by
 * {@link reclaimPluginBuildLock}, carrying the generation and protocol the
 * waiter observed. A v3 observer is recorded inside that generation so its
 * tombstone remains while the observing process can still use the fence,
 * preventing a stale fence from retiring a successor. Legacy fences cannot
 * provide that guarantee against old executables that delete their lock path.
 *
 * @evidence contracts/common.md#principled-implementation Protocol and generation distinguish a captured legacy fence from an observer-protected v3 retirement identity.
 * @evidence contracts/common.md#clear-and-simple-design The token contains no mutable pathname observation; inspection owns registration and reclamation owns retirement.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fence retains the observed generation rather than substituting a successor's current identity after a delay.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs identify producer, consumer and observer lifetime; member comments explain protocol and generation separately from tags.
 * @evidence contracts/portability.md#os-neutral-implementation Tokens use protocol discriminants and hexadecimal identity; callers derive native paths through the protocol adapter rather than embedding filesystem syntax in the token.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export type PluginBuildLockFence = {
  /** Which lock protocol held the observed generation. */
  protocol: "legacy" | "v3";

  /** The 128-bit hex id of the observed generation. */
  generation: string;
};
