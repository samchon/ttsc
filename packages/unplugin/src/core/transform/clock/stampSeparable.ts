import type fs from "node:fs";

import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { filesystemClockReferences } from "./filesystemClockReferences";

/**
 * Report whether a later write to the observed path is guaranteed to move its
 * modification stamp: the device's current probe holds a stamp strictly newer,
 * so the tick that minted the stamp is provably over. The probe was written
 * before the caller's content read began, which is the ordering the guarantee
 * needs — a stamp minted before the read proves every post-read write lands in
 * a newer tick.
 */
export function stampSeparable(
  filesystem: TtscTransformFilesystemOperations,
  stats: fs.BigIntStats,
): boolean {
  const reference = filesystemClockReferences(filesystem).get(stats.dev);
  return reference !== undefined && stats.mtimeNs < reference;
}
