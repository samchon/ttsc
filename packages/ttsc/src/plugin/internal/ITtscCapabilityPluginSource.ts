/**
 * One plugin source directory as the capability-resolution cache records it:
 * the state the load reported for it, and, when the entry's writer could vouch
 * for it, the digest of its files with the metadata signature they were read
 * under (samchon/ttsc#1492).
 *
 * The state is what the cached binary path stands for, and a read proves it by
 * the build's own rule (`pluginSourceStateHolds`). Reading every file of a
 * plugin's module costs half a second for `@ttsc/lint`'s, on every read, so a
 * read whose signature still matches, and is still separable from a clock
 * reference minted then, hands the recorded digest to the proof instead, and
 * only the build environment is read again. `digest` and `signature` are
 * recorded together or not at all.
 *
 * @evidence contracts/common.md#principled-implementation The authoritative source state remains required; optional digest/signature are a jointly recorded acceleration witness accepted only under the reader's metadata and clock proof.
 * @evidence contracts/common.md#clear-and-simple-design The record separates the build identity from optional file-read reuse evidence instead of treating metadata alone as the source state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Absent witnesses require the full source proof; a matching timestamp alone is not fabricated permission to reuse the binary state.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains paired optional fields, read/write proof responsibility and the clock-separation premise; member and tag separation follow the documentation skill.
 */
export interface ITtscCapabilityPluginSource {
  /** The directory's state, as `pluginSourceState` reports it. */
  state: string;

  /** The digest of the directory's files, as `pluginSourceDigest` reads it. */
  digest?: string;

  /**
   * The metadata signature of exactly those files
   * (`pluginSourceFilesSignature`), taken before and after the digest was read
   * and equal both times, with every stamp separable.
   */
  signature?: string;
}
