import { TtscGraphSession } from "@ttsc/graph";
import { TestProject } from "@ttsc/testing";

import { assert, resolveTtscgraphBinary } from "../internal/ttsgraph";

/**
 * Verifies the native request deadline rejects unsafe timer values.
 *
 * Node clamps oversized, fractional, and non-finite timers in surprising ways.
 * Accepting those values would turn a configured safety boundary into an
 * immediate timeout or an effectively different deadline.
 *
 * 1. Construct sessions at the zero, fractional, non-finite, and timer-overflow
 *    boundaries.
 * 2. Assert each is rejected before any child can spawn.
 * 3. Construct the maximum valid integer timeout and close it without spawning.
 */
export const test_ttscgraph_native_request_timeout_option_rejects_unsafe_values =
  () => {
    const cwd = TestProject.tmpdir("ttscgraph-timeout-option-");
    const binary = resolveTtscgraphBinary();
    const construct = (requestTimeoutMs: number) =>
      new TtscGraphSession({
        cwd,
        tsconfig: "tsconfig.json",
        binary,
        requestTimeoutMs,
      });
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => construct(value), /requestTimeoutMs/);
    }
    assert.throws(() => construct(2_147_483_648), /requestTimeoutMs/);
    const maximum = construct(2_147_483_647);
    maximum.close();
    const defaults = new TtscGraphSession({
      cwd,
      tsconfig: "tsconfig.json",
      binary,
    });
    assert.equal(
      (
        defaults as unknown as {
          requestTimeoutMs: number;
        }
      ).requestTimeoutMs,
      300_000,
    );
    defaults.close();
  };
