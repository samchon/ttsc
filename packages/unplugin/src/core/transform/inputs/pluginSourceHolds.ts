import { pluginSourceStateHolds } from "ttsc/plugin-source";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { pluginSourceFilesDigest } from "./pluginSourceFilesDigest";

/**
 * Whether one plugin source directory still holds the state a transform
 * reported for it: its sources and the environment a build there is keyed on
 * (`pluginSourceStateHolds` from `ttsc/plugin-source`, samchon/ttsc#1493).
 *
 * Every proof compares through here rather than against a state read once: this
 * process keeps its reading of the build environment while the toolchain paths
 * it depended on hold, and the proof reads it again before it refutes a state,
 * so the adapter never refutes the output its own compiler just produced. The
 * sources' digest is read again only when the metadata of their files moved
 * (`pluginSourceFilesDigest`). A directory a file below could not be read from
 * proves nothing.
 *
 * @param directory The source directory, as the envelope names it.
 * @param state The state the envelope, a record, or a capture recorded.
 * @param filesystem The operations whose clock reference the caller refreshed.
 */
export function pluginSourceHolds(
  directory: string,
  state: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): boolean {
  try {
    return pluginSourceStateHolds(directory, state, {
      sourceDigest: pluginSourceFilesDigest(directory, filesystem),
    });
  } catch {
    return false;
  }
}
