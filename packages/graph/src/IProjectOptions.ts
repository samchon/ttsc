/**
 * Project coordinates passed to the native graph producer.
 *
 * @evidence contracts/common.md#principled-implementation Absolute working directory and configuration locator determine which project the producer loads.
 * @evidence contracts/common.md#clear-and-simple-design Two shared coordinates prevent launcher lanes from owning competing project defaults.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Configuration remains caller-selected rather than pinned to a named repository.
 * @evidence contracts/common.md#meaningful-documentation Native member comments identify directory absoluteness and configuration relativity.
 */
export interface IProjectOptions {
  /** Absolute project working directory. */
  cwd: string;

  /** Configuration path, relative to cwd unless already absolute. */
  tsconfig: string;
}
