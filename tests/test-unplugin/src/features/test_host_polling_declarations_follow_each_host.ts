import assert from "node:assert/strict";

import { hostDeclaresPolling } from "../../../../packages/unplugin/src/core/transform/tracker/hostDeclaresPolling";

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
 * only force polling when the canonical numeric conversion is truthy. Watchpack
 * 2.5.1 stores that conversion in FORCE_POLLING and tests its truthiness: NaN
 * does not force polling, while nonzero negative and infinite values do. This
 * case identifies declarations, not their timer behavior.
 *
 * 1. Evaluate each declaration against the host option it overrides.
 * 2. Assert the verdict is the one the host itself reaches.
 *
 * @evidence contracts/testing.md#behavioral-verification hostDeclaresPolling interprets Chokidar environment overrides and Watchpack intervals, allowing either host to require polling, including a present-but-empty Chokidar value overriding the option and non-canonical Watchpack numerals. Canonical NaN is false, negative/infinite canonical numbers are true, and Chokidar true remains sufficient beside NaN.
 * @evidence contracts/testing.md#independent-expectations The literal boolean table follows the supported Chokidar/Watchpack option conventions, including environment false overriding configured true. Watchpack 2.5.1 DirectoryWatcher FORCE_POLLING canonical conversion and its constructor truthiness gate independently define NaN versus nonzero negative/infinite literal verdicts; the test does not calculate expectations from product parsing.
 * @evidence contracts/testing.md#distinguishing-cases Absent, true/TRUE/1/yes, empty/false/0 and positive numeric interval forms plus NaN, negative/infinite canonical numbers and conflicting hosts distinguish polling declarations from no declaration. Actual timer/native observation remains outside this unit.
 * @evidence contracts/testing.md#execution-ownership Calls hostDeclaresPolling on explicitly supplied environment objects; every row retains its serialized env/usePolling failure identity and starts no observer.
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
    // chokidar 3 reads a present-but-empty value as `!!""`, so it overrides a
    // polling option too, and compares `false` without regard to case.
    [{ CHOKIDAR_USEPOLLING: "" }, true, false],
    [{ CHOKIDAR_USEPOLLING: "FALSE" }, true, false],
    [{ WATCHPACK_POLLING: "true" }, undefined, true],
    [{ WATCHPACK_POLLING: "500" }, undefined, true],
    // Watchpack 2 takes a canonical numeric string as an interval and any
    // other non-empty string but "false" as true.
    [{ WATCHPACK_POLLING: "0.5" }, undefined, true],
    [{ WATCHPACK_POLLING: "NaN" }, undefined, false],
    [{ WATCHPACK_POLLING: "Infinity" }, undefined, true],
    [{ WATCHPACK_POLLING: "-Infinity" }, undefined, true],
    [{ WATCHPACK_POLLING: "-1" }, undefined, true],
    [{ WATCHPACK_POLLING: "00" }, undefined, true],
    [{ WATCHPACK_POLLING: "0" }, undefined, false],
    [{ WATCHPACK_POLLING: "false" }, undefined, false],
    [{ WATCHPACK_POLLING: "" }, undefined, false],
    // Either host declaring polling is enough.
    [{ CHOKIDAR_USEPOLLING: "false", WATCHPACK_POLLING: "true" }, true, true],
    [
      { CHOKIDAR_USEPOLLING: "true", WATCHPACK_POLLING: "NaN" },
      undefined,
      true,
    ],
  ];
  for (const [env, usePolling, expected] of rows) {
    assert.equal(
      hostDeclaresPolling(env, usePolling),
      expected,
      `${JSON.stringify(env)} with usePolling ${String(usePolling)}`,
    );
  }
}
