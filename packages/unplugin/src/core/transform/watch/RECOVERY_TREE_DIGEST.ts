import type { TtscWatchInput } from "./TtscWatchInput";

/**
 * The internal recovery condition attached to a watcher registration.
 *
 * @evidence contracts/common.md#principled-implementation The input retains its public evidence while a separate observer condition tracks the source.
 * @evidence contracts/common.md#clear-and-simple-design Only producers, registration and the observer share the weak attachment.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing attachments remain undefined, distinct from a tree whose target was unavailable.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies the attachment's lifetime and purpose.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The attachment owns no native operation.
 * @evidence contracts/performance.md#efficient-algorithms Maintains one digest per attached registration with native WeakMap lookup costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This attachment keeps a producer observation and does not validate it.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The weak key releases the digest when its registration is unreachable.
 */
export const RECOVERY_TREE_DIGEST = new WeakMap<
  TtscWatchInput,
  string | null
>();
