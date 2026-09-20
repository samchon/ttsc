import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * What a delivery's watch notifications need from the project selection that
 * routed its file: the configs the selection read, which are handed to the host
 * beside every notification's own inputs (`selectionInputs`), the filesystem
 * their evidence is read through, and the selected tsconfig, which spells the
 * project for a notification that has no generation to spell it.
 */
export interface TtscWatchSelection {
  /** The configs the selection read, in the order it read them. */
  readonly consulted: readonly string[];
  /** The filesystem the delivery reads through. */
  readonly filesystem: TtscTransformFilesystemOperations;
  /** The selected project's tsconfig, as the adapter names it. */
  readonly tsconfig: string;
}
