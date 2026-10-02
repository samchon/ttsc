/**
 * The universal host-input manifest a generation records at capture.
 *
 * Universal inputs, such as plugin descriptors, their config files, and package
 * manifests read by discovery, can affect every module, so they are proven once
 * for the generation, not once per delivery. Existing inputs keep the metadata
 * signature that can stand in for their content. Absent ones retain raw native
 * candidates grouped by their nearest directory, or are checked by their exact
 * native paths when directory case policy is unknown. `covered` records which
 * lexical spellings the manifest answers for, so the per-module loop can skip
 * exactly those and no others.
 *
 * @evidence contracts/common.md#principled-implementation Existing entries, raw nearest-ancestor candidates, exact full-path probes and source-tree states retain distinct authority; lexical covered spellings cannot be replaced by physical identity or normalized listing names.
 * @evidence contracts/common.md#clear-and-simple-design Separate populations expose each validator's responsibility while one generation owns their shared lifetime.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Readable content, blockers and external build environments remain explicit rather than one blanket watcher-success flag.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs and separated member comments explain optional signatures, exact coverage, absence groups and tree environments.
 * @evidence contracts/portability.md#os-neutral-implementation Physical targets, lexical aliases, metadata clocks and qualified native notifications remain separate; actual case policy belongs to the generation context.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscHostInputValidation only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscHostInputValidation only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscHostInputValidation only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscHostInputValidation {
  /** Lexical input spellings that existed when the generation was captured. */
  readonly entries: Map<
    string,
    {
      /** Exact lexical spelling whose metadata and notifications qualify it. */
      path: string;

      /**
       * Whether the recorded host state qualified content or native kind.
       * Capture sets it for a nonnull byte hash or directory marker; a
       * strict blocker carries separate kind authority even without a byte read.
       * A current module supplied from an editor buffer can earn it later after
       * its disk bytes match the recorded source.
       *
       * An unreadable nondirectory input can record a missing state, so no
       * signature may stand in for it: its metadata holds still while the bytes
       * behind it appear.
       */
      readable: boolean;

      /** Physical target selected when this entry was admitted. */
      realpath: string | null;

      /**
       * The signature that may stand in for this entry's content comparison, or
       * `undefined` when none may. A blocker keeps one regardless: it proves a
       * kind and an identity rather than content.
       */
      signature: string | undefined;

      /** Non-directory ancestor whose kind blocks the missing descendant. */
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
   * Original child-name candidates grouped by their nearest directory. Native
   * stat of each joined spelling, not directory-entry inequality, proves absence.
   */
  readonly missing: Map<string, Set<string>>;

  /**
   * Exact absent paths checked through native stat when a directory's case
   * policy is unknown. Only ENOENT or ENOTDIR proves
   * continued absence; permission and other observation failures reject reuse.
   */
  readonly directMissing?: Set<string>;

  /**
   * The plugin source directories of the generation, each with the state its
   * binary was built from, its files and build environment (samchon/ttsc#1487,
   * samchon/ttsc#1493). No one path's metadata stands for a directory's files,
   * so each is proven by ttsc's rule (`pluginSourceHolds`) unless its tracker
   * proves it unchanged; the proof reads the files' bytes again only when the
   * population, metadata or fresh clock evidence cannot qualify the digest last read
   * (`pluginSourceFilesDigest`).
   */
  readonly trees: Map<string, string>;

  /**
   * The build environment (`processPluginBuildEnvironment` from
   * `ttsc/plugin-source`) each tree was last proven under. A tracker's silence
   * proves a tree's files, never the Go toolchain and environment outside it,
   * so a silent tree is skipped only while this process's environment reading,
   * itself kept only while its toolchain paths hold, is still this one
   * (samchon/ttsc#1516).
   */
  treeEnvironments?: Map<string, string>;
}
