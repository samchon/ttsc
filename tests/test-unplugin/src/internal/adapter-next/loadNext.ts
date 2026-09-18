import fs from "node:fs";

import type { INextLikeConfig } from "./INextLikeConfig";
import { loadNextModule } from "./loadNextModule";

/** Environment variable the wrapper sets to the Turbopack workers' session. */
const SESSION_ENV = "TTSC_UNPLUGIN_TRANSFORM_SESSION";

/**
 * Load the built `next` adapter entry.
 *
 * The wrapper opens a transform session for Turbopack's workers by setting a
 * process-wide variable (samchon/ttsc#1390). This runner shares one process
 * among every scenario, so each call's session is closed again before the call
 * returns, and later scenarios see the environment they started with. The
 * session itself is covered in a child process by
 * `test_next_adapter_opens_a_session_its_workers_inherit`.
 */
export async function loadNext(): Promise<
  (config?: INextLikeConfig, options?: unknown) => INextLikeConfig
> {
  const next = (await loadNextModule()).default;
  return (config, options) => {
    const previous = process.env[SESSION_ENV];
    try {
      return next(config, options);
    } finally {
      const opened = process.env[SESSION_ENV];
      if (opened !== undefined && opened !== previous) {
        fs.rmSync(opened, { force: true, recursive: true });
      }
      if (previous === undefined) delete process.env[SESSION_ENV];
      else process.env[SESSION_ENV] = previous;
    }
  };
}
