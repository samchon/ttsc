import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/lib/core/transform/filesystem/TtscTransformFilesystemOperations.mjs";

/**
 * A plugin source whose Go build environment moves in the middle of the proof
 * that reads it (`createMovingEnvironmentFixture`).
 */
export interface IMovingEnvironmentFixture {
  /** A project with a tsconfig and one module. */
  project: string;
  /** A plugin's Go module, outside `project`. */
  source: string;
  /**
   * The observed filesystem: the host's, except that its first metadata read
   * below `source` writes a `GOFLAGS` line into the Go environment file, which
   * moves the environment while the proof that made the read is running.
   */
  filesystem: TtscTransformFilesystemOperations;
  /** This process's environment reading for `source` before the move. */
  before: string;
  /** The environment reading for `source` once the move has landed. */
  moved: string;
  /** The state of `source` under the moved environment, which the proof holds. */
  movedState: string;
  /** How many metadata reads below `source` went through `filesystem`. */
  reads(): number;
  /** Start counting `reads()` from zero. */
  resetReads(): void;
  /** Restore `GOENV`. */
  dispose(): void;
}
