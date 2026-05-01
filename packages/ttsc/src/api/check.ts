import type { ITtscBuildResult, ITtscCheckOptions } from "../structures";

import { build } from "./build";

/** Run a diagnostics-only TypeScript-Go project check through ttsc. */
export function check(options: ITtscCheckOptions = {}): ITtscBuildResult {
  return build({ ...options, emit: false });
}
