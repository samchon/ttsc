import type { TtscWatchInput } from "./TtscWatchInput";

/**
 * The internal recovery condition attached to a watcher registration.
 *
 * A missing attachment is undefined. A null digest records an unavailable
 * target. The weak key releases the digest with its registration.
 */
export const RECOVERY_TREE_DIGEST = new WeakMap<
  TtscWatchInput,
  string | null
>();
