import assert from "node:assert/strict";

import { hostDeclaresPolling } from "../../../../../packages/unplugin/lib/core/transform/tracker/hostDeclaresPolling.mjs";

/**
 * Verifies ttsc reads a polling declaration exactly as the host that owns it
 * does (samchon/ttsc#1395).
 *
 * WSL2 drive mounts, Docker Desktop bind mounts, and network shares accept a
 * native watch and then report nothing, so their users set their host to poll.
 * ttsc must agree with the host: when the host polls, silence from a native
 * watcher is not evidence, and when the host does not poll, the native
 * observers keep their bounded cost. The rows mirror chokidar 3 and 4, where
 * the environment overrides `usePolling`, and Watchpack 2, whose numeric values
 * are intervals.
 *
 * 1. Evaluate each declaration against the host option it overrides.
 * 2. Assert the verdict is the one the host itself reaches.
 */
export async function test_host_polling_declarations_follow_each_host(): Promise<void> {
  const rows: [NodeJS.ProcessEnv, boolean | undefined, boolean][] = [
    [{}, undefined, false],
    [{}, true, true],
    [{ CHOKIDAR_USEPOLLING: "true" }, undefined, true],
    [{ CHOKIDAR_USEPOLLING: "TRUE" }, undefined, true],
    [{ CHOKIDAR_USEPOLLING: "1" }, undefined, true],
    [{ CHOKIDAR_USEPOLLING: "yes" }, undefined, true],
    [{ CHOKIDAR_USEPOLLING: "" }, undefined, false],
    // The environment overrides the host option in both directions.
    [{ CHOKIDAR_USEPOLLING: "false" }, true, false],
    [{ CHOKIDAR_USEPOLLING: "0" }, true, false],
    [{ WATCHPACK_POLLING: "true" }, undefined, true],
    [{ WATCHPACK_POLLING: "500" }, undefined, true],
    [{ WATCHPACK_POLLING: "0" }, undefined, false],
    [{ WATCHPACK_POLLING: "false" }, undefined, false],
    [{ WATCHPACK_POLLING: "" }, undefined, false],
    // Either host declaring polling is enough.
    [{ CHOKIDAR_USEPOLLING: "false", WATCHPACK_POLLING: "true" }, true, true],
  ];
  for (const [env, usePolling, expected] of rows) {
    assert.equal(
      hostDeclaresPolling(env, usePolling),
      expected,
      `${JSON.stringify(env)} with usePolling ${String(usePolling)}`,
    );
  }
}
