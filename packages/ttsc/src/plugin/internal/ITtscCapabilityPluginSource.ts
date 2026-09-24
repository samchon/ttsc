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
