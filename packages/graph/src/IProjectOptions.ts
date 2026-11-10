/**
 * Project coordinates and optional compiler permission for the graph producer.
 *
 * @evidence contracts/common.md#principled-implementation Project coordinates select the load while optional permission preserves an explicit true, false or inherited compiler choice.
 * @evidence contracts/common.md#clear-and-simple-design Two shared coordinates prevent launcher lanes from owning competing project defaults.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Configuration remains caller-selected rather than pinned to a named repository.
 * @evidence contracts/common.md#meaningful-documentation Native member comments identify directory absoluteness and configuration relativity.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface IProjectOptions {
  /** Absolute project working directory. */
  cwd: string;

  /** Configuration path, relative to cwd unless already absolute. */
  tsconfig: string;

  /** Upstream content-mapper permission; omission preserves inherited flags. */
  runExternalCode?: boolean;
}
