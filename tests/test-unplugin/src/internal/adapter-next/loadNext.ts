import { TestProject } from "@ttsc/testing";

import type { INextLikeConfig } from "./INextLikeConfig";
import { loadNextModule } from "./loadNextModule";

/** Environment variable the wrapper sets to the Turbopack workers' session. */
const SESSION_ENV = "TTSC_UNPLUGIN_TRANSFORM_SESSION";

/** The variables `os.tmpdir()` reads, on every platform. */
const TEMPORARY_ENV = ["TEMP", "TMP", "TMPDIR"];

/**
 * Load the built `next` adapter entry.
 *
 * The wrapper opens a transform session for Turbopack's workers by setting a
 * process-wide variable (samchon/ttsc#1390). This runner shares one process
 * among every scenario, so each call's session is closed again before the call
 * returns, and later scenarios see the environment they started with. The store
 * outlives every process (samchon/ttsc#1483) and belongs to the user, so each
 * call opens it below a temporary directory of its own, never the user's, which
 * the process removes when it exits. The session itself is covered in a child
 * process by `test_next_adapter_opens_a_session_its_workers_inherit`.
 */
export async function loadNext(): Promise<
  (config?: INextLikeConfig, options?: unknown) => INextLikeConfig
> {
  const next = (await loadNextModule()).default;
  return (config, options) => {
    const previous = process.env[SESSION_ENV];
    const temporary = TEMPORARY_ENV.map((key) => [key, process.env[key]]);
    const isolated = TestProject.tmpdir("ttsc-next-session-");
    for (const key of TEMPORARY_ENV) process.env[key] = isolated;
    try {
      return next(config, options);
    } finally {
      for (const [key, value] of temporary) {
        if (value === undefined) delete process.env[key!];
        else process.env[key!] = value;
      }
      if (previous === undefined) delete process.env[SESSION_ENV];
      else process.env[SESSION_ENV] = previous;
    }
  };
}
