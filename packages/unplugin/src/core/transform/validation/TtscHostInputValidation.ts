/**
 * The universal host-input manifest a generation records at capture.
 *
 * Universal inputs, such as plugin descriptors, their config files, and package
 * manifests read by discovery, can affect every module, so they are proven once
 * for the generation, not once per delivery. Existing inputs keep the metadata
 * signature that can stand in for their content. Absent ones are grouped by the
 * directory whose listing proves them still absent. `covered` records which
 * lexical spellings the manifest answers for, so the per-module loop can skip
 * exactly those and no others.
 */
export interface TtscHostInputValidation {
  /** Lexical input spellings that existed when the generation was captured. */
  readonly entries: Map<
    string,
    {
      path: string;
      /**
       * Whether the recorded state of this input has been matched to readable
       * bytes. Capture sets it immediately for compiler-proven inputs; a
       * current module supplied from an editor buffer can earn it later after
       * its disk bytes match the recorded source.
       *
       * An input that still cannot be read records a missing state, so no
       * signature may stand in for it: its metadata holds still while the bytes
       * behind it appear.
       */
      readable: boolean;
      realpath: string | null;
      /**
       * The signature that may stand in for this entry's content comparison, or
       * `undefined` when none may. A blocker keeps one regardless: it proves a
       * kind and an identity rather than content.
       */
      signature: string | undefined;
      strict?: true;
    }
  >;
  /**
   * Lexical spellings the manifest accounts for, omitted from the per-module
   * dependency loop below.
   *
   * Spellings, not identities: a symlink and its target share one identity but
   * are two inputs, and skipping the alias because the manifest proved the
   * target would leave the alias's own retarget unvalidated.
   */
  readonly covered: Set<string>;
  /**
   * Missing paths grouped by the nearest directory whose listing proves them
   * absent.
   */
  readonly missing: Map<string, Set<string>>;
  /**
   * The plugin source directories of the generation, each with the state its
   * binary was built from, its files and build environment (samchon/ttsc#1487,
   * samchon/ttsc#1493). No one path's metadata stands for a directory's files,
   * so each is proven by ttsc's rule (`pluginSourceHolds`) unless its tracker
   * proves it unchanged; the proof reads the files' bytes again only when the
   * metadata of every one of them no longer vouches for the digest last read
   * (`pluginSourceFilesDigest`).
   */
  readonly trees: Map<string, string>;
}
