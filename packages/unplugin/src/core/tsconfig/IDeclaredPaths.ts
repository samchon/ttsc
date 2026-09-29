/**
 * The `paths` object found while walking one tsconfig's `extends` chain,
 * together with the directory of the config that declared it (the anchor for
 * relative targets).
 *
 * @evidence contracts/common.md#principled-implementation
 *   Raw paths values travel with their declaring directory so inherited
 *   relative targets can be anchored without assuming the consumer owns them.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Two members couple declaration provenance with one paths object; option
 *   validation and target expansion remain reader responsibilities.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   baseDir is a native declaring anchor while paths holds raw config syntax;
 *   their separate members prevent treating target patterns as resolved identity.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The raw record preserves unknown input for validation instead of embedding
 *   aliases selected for a known consumer.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains the inherited anchor and member comments distinguish
 *   the declaring directory from raw compiler data.
 */
export interface IDeclaredPaths {
  /**
   * Directory of the config that declared `paths`, which anchors relative
   * targets.
   */
  baseDir: string;

  /** The raw `compilerOptions.paths` object as declared. */
  paths: Record<string, unknown>;
}
