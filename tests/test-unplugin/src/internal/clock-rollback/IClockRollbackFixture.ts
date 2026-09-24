import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/lib/core/transform/filesystem/TtscTransformFilesystemOperations.mjs";

/**
 * A project and a plugin source beside it, observed through a filesystem whose
 * clock the scenario can step back (`createClockRollbackFixture`).
 */
export interface IClockRollbackFixture {
  /** The fixture's root, holding the project and the plugin source. */
  root: string;
  /** A project with a tsconfig and one module, below `root`. */
  project: string;
  /** A plugin's Go module, below `root` and outside `project`. */
  source: string;
  /**
   * The observed filesystem: the host's, except that metadata the scenario
   * holds is reported as it was held, and every file stamped outside `root`,
   * which is the adapter's own clock probe, is reported with the clock's step.
   */
  filesystem: TtscTransformFilesystemOperations;
  /** Move every stamp below `source` an hour back, out of any tick minted now. */
  settle(): void;
  /**
   * Mint the clock reference an earlier proof left behind, in a probe directory
   * outside `root`, as a delivery mints in its generation's.
   */
  mintEarlier(): void;
  /**
   * Hold the metadata of every file below `source` as it stands, as a write the
   * clock put into the same tick leaves it.
   */
  hold(): void;
  /** Change the bytes of a file below `source`, keeping its file set. */
  edit(): void;
  /**
   * Step the filesystem's clock two hours back, so a probe minted from now on
   * is stamped before every settled stamp.
   */
  stepBack(): void;
}
