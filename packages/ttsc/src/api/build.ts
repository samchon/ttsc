import type { ITtscBuildOptions, ITtscBuildResult } from "../structures";

import { runBuild } from "./internal/runBuild";

/** Run a TypeScript-Go project build through ttsc. */
export function build(options: ITtscBuildOptions = {}): ITtscBuildResult {
  return runBuild(options);
}
