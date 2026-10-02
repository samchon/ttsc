import type { OwningModuleOptions } from "./OwningModuleOptions";

/**
 * Checked build metadata inherited by a direct ttsx child or registered by a
 * host that discovers roots after hook installation.
 *
 * The directories and actual compiler emit observations describe already-built
 * output; the hooks use them to establish which preparation owns a source.
 *
 * @evidence contracts/common.md#principled-implementation Native source/emit roots, actual output-to-source observations and owning format options bind serving to one checked preparation; optional entry/output-list/policy fields cannot replace the required compiler provenance.
 * @evidence contracts/common.md#clear-and-simple-design One serializable build manifest groups serving identity and its run-owned caches, keeping loader callbacks and mutable lock state outside the transport.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit entry/output ownership and plugin policy replace basename guesses or independently chosen transform behavior for later roots.
 * @evidence contracts/common.md#meaningful-documentation The purpose and separated member comments explain native paths, required actual emit provenance, protocol output separators, module/target defaults, orphan lifetime and false-only plugin policy without member tags.
 * @evidence contracts/portability.md#os-neutral-implementation Native root/entry/cache paths remain distinct from slash-separated relative output records; producers resolve physical source identity and consumers convert output spelling through the filesystem boundary.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface RuntimeManifest {
  /** Project root of the entry's owning tsconfig. */
  readonly projectRoot: string;

  /** Source-tree root the emit mirrors (tsgo strips this prefix). */
  readonly rootDir: string;

  /** Directory holding the entry project's emitted JavaScript. */
  readonly emitDir: string;

  /** Physical TypeScript root whose checked preparation created this manifest. */
  readonly entrySource?: string;

  /** Exact JavaScript emitted for `entrySource`. */
  readonly entryFile?: string;

  /**
   * The build's record of the JavaScript it emitted, relative to `emitDir` with
   * `/` separators. This lists available outputs; actual source ownership is
   * established by emittedSources rather than reconstructing source
   * membership.
   */
  readonly outputs?: readonly string[];

  /** Actual absolute native output-to-source observations of this checked emit. */
  readonly emittedSources: Readonly<Record<string, readonly string[]>>;

  /** Observed output-specific proof refusals; diagnostic context is not proof. */
  readonly emittedSourceProofFailures?: Readonly<Record<string, string>>;

  /**
   * The entry tsconfig's `module` and `target`, deciding emit CJS/ESM per file.
   * `target` is not decoration: an absent `module` makes tsgo derive the module
   * kind from it.
   */
  readonly moduleOptions?: Readonly<OwningModuleOptions>;

  /** Root directory for per-dependency build output. */
  readonly depCacheDir: string;

  /**
   * Directory of the lowered orphan sources, under the run's resolved cache
   * root, which outlives the run.
   */
  readonly orphanCacheDir?: string;

  /**
   * `false` when the run disabled transform plugins (`ttsx --no-plugins`). A
   * TypeScript root the program reaches outside every checked build is part of
   * the same run, so it is compiled under the same plugin policy as the entry.
   */
  readonly plugins?: false;
}
