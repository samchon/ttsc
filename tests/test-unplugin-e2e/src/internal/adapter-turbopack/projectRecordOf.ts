import path from "node:path";

import { hostToolDirectory } from "../../../../../packages/unplugin/lib/core/bridge/hostToolDirectory.js";
import { projectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/projectRecordFile.js";

/**
 * The project record the Turbopack loader registers as the one dependency of
 * every module of a fixture project beside the module itself: the file below
 * the project's tool directory that carries the project's state
 * (`projectRecordFile`).
 */
export function projectRecordOf(root: string): string {
  return projectRecordFile(
    hostToolDirectory(root),
    path.join(root, "tsconfig.json"),
  );
}
