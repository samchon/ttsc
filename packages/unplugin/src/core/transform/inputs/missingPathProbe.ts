import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/** Find one directory listing that proves an absent path is still absent. */
export function missingPathProbe(
  file: string,
  filesystem: TtscTransformFilesystemOperations = DEFAULT_FILESYSTEM_OPERATIONS,
): {
  blocker?: string;
  directory: string;
  name: string;
} {
  let child = path.resolve(file);
  for (;;) {
    const directory = path.dirname(child);
    try {
      const stats = filesystem.stat(directory);
      if (stats.isDirectory()) {
        return { directory, name: path.basename(child) };
      }
      return {
        blocker: directory,
        directory: path.dirname(directory),
        name: path.basename(directory),
      };
    } catch {}
    if (directory === child) {
      return { directory, name: path.basename(child) };
    }
    child = directory;
  }
}
