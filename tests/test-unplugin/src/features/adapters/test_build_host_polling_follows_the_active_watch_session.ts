import assert from "node:assert/strict";

import { buildHostDeclaresPolling } from "../../../../../packages/unplugin/src/core/bridge/buildHostDeclaresPolling";

type NativeBuildContext = Parameters<typeof buildHostDeclaresPolling>[0];

/**
 * Verifies active build-host session options determine polling (#1672).
 *
 * Direct watch() options can override compiler configuration and a reused
 * compiler can start another session. These public capability carriers do not
 * model native event delivery or invoke a bundler.
 *
 * 1. Compare explicit intervals, boolean options and native defaults for both
 *    hosts.
 * 2. Follow Watchpack overrides independently of unrelated Chokidar flags.
 * 3. Close and restart one carrier, then read the new session's declaration.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual buildHostDeclaresPolling selector with Webpack/Rspack public session carriers and explicit environments, including session replacement and absence after closure.
 * @evidence contracts/testing.md#independent-expectations Literal expected booleans follow active watch() options and Watchpack's positive-only environment forcing; Chokidar flags do not govern these hosts. Compiler configuration is deliberately contradictory.
 * @evidence contracts/testing.md#distinguishing-cases Both hosts cross true, false, absent, zero, positive and negative numeric options, NaN and infinity with Watchpack numeric/string on/off declarations and unrelated Chokidar on/off flags. Closure and restart remove prior session policy; non-matching hosts and absent native context retain generic environment policy.
 * @evidence contracts/testing.md#execution-ownership Only the policy selector executes; authored structural capability carriers acquire no compiler, watcher, process or filesystem fixture.
 */
export async function test_build_host_polling_follows_the_active_watch_session(): Promise<void> {
  for (const framework of ["webpack", "rspack"] as const) {
    const compiler: {
      options: { watchOptions: { poll: boolean } };
      watching?: { watchOptions: { poll?: boolean | number } };
    } = { options: { watchOptions: { poll: true } } };
    const native = { framework, compiler } as unknown as NativeBuildContext;
    assert.equal(buildHostDeclaresPolling(native, {}), false, framework);
    const rows: [boolean | number | undefined, boolean][] = [
      [undefined, false],
      [false, false],
      [true, true],
      [0, false],
      [100, true],
      [-1, true],
      [NaN, false],
      [Infinity, true],
    ];
    const environments: [NodeJS.ProcessEnv, boolean][] = [
      [{}, false],
      ...["false", "0", "", "true", "1", "yes"].map(
        (value): [NodeJS.ProcessEnv, boolean] => [
          { CHOKIDAR_USEPOLLING: value },
          false,
        ],
      ),
      ...["true", "100", "-1", "0.5", "Infinity", "00"].map(
        (value): [NodeJS.ProcessEnv, boolean] => [
          { WATCHPACK_POLLING: value },
          true,
        ],
      ),
      ...["false", "0", "", "NaN"].map(
        (value): [NodeJS.ProcessEnv, boolean] => [
          { WATCHPACK_POLLING: value },
          false,
        ],
      ),
      [{ CHOKIDAR_USEPOLLING: "true", WATCHPACK_POLLING: "false" }, false],
      [{ CHOKIDAR_USEPOLLING: "false", WATCHPACK_POLLING: "true" }, true],
    ];
    for (const [poll, expected] of rows) {
      compiler.watching = { watchOptions: { poll } };
      for (const [env, forcesPolling] of environments)
        assert.equal(
          buildHostDeclaresPolling(native, env),
          expected || forcesPolling,
          `${framework} poll=${poll} env=${JSON.stringify(env)}`,
        );
    }
    compiler.options.watchOptions.poll = false;
    compiler.watching = { watchOptions: { poll: 100 } };
    assert.equal(buildHostDeclaresPolling(native, {}), true);
    assert.equal(
      buildHostDeclaresPolling(native, { CHOKIDAR_USEPOLLING: "false" }),
      true,
    );
    assert.equal(
      buildHostDeclaresPolling(native, {
        CHOKIDAR_USEPOLLING: "false",
        WATCHPACK_POLLING: "true",
      }),
      true,
    );
    compiler.watching = undefined;
    for (const [env, forcesPolling] of environments)
      assert.equal(buildHostDeclaresPolling(native, env), forcesPolling);
    compiler.watching = { watchOptions: { poll: false } };
    for (const [env, forcesPolling] of environments)
      assert.equal(buildHostDeclaresPolling(native, env), forcesPolling);
    assert.equal(
      buildHostDeclaresPolling(native, { WATCHPACK_POLLING: "100" }),
      true,
    );
  }
  assert.equal(buildHostDeclaresPolling(undefined, {}), false);
  assert.equal(
    buildHostDeclaresPolling(undefined, { WATCHPACK_POLLING: "true" }),
    true,
  );
  assert.equal(
    buildHostDeclaresPolling({ framework: "farm" } as NativeBuildContext, {}),
    false,
  );
  for (const native of [
    undefined,
    { framework: "farm" } as NativeBuildContext,
  ]) {
    assert.equal(
      buildHostDeclaresPolling(native, { CHOKIDAR_USEPOLLING: "true" }),
      true,
    );
    assert.equal(
      buildHostDeclaresPolling(native, { CHOKIDAR_USEPOLLING: "false" }),
      false,
    );
  }
}
