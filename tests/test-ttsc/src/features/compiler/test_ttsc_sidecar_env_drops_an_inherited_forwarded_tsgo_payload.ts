import assert from "node:assert/strict";

import {
  SEMANTIC_CONFIG_PATH_ENV,
  TSGO_ARGS_ENV,
  clearInheritedSemanticConfigPath,
  clearInheritedTsgoArgs,
} from "../../../../../packages/ttsc/lib/compiler/internal/sharedHostHelpers.js";

/**
 * Verifies a sidecar environment drops per-invocation compiler state it did not
 * publish.
 *
 * Every native sidecar environment starts from `process.env`, and since issue
 * #1188 the forwarded tsgo argv travels in one. A ttsc running inside a plugin
 * sidecar — `@ttsc/lint` evaluating a config file through `ttsx`, for instance
 * — therefore inherits the outer run's payload, and `driver.LoadProgram` would
 * apply the outer `--strict` to an inner build that never asked for it. The
 * payload is per-invocation state the spawning host owns, so a lane that
 * forwards nothing must clear it, exactly as `TTSC_PLUGIN_CONFIG_DIR` already
 * does. Generated-wrapper config ownership follows the same rule: it belongs
 * only to the unplugin compile that created the wrapper and must not leak into
 * a nested build. A caller that named either variable itself still wins.
 *
 * 1. Clear an inherited value no caller named.
 * 2. Keep a value the caller named explicitly.
 * 3. Leave an environment that carries no payload untouched.
 * 4. Apply the same inherited-versus-declared rule to semantic config ownership.
 */
export const test_ttsc_sidecar_env_drops_an_inherited_forwarded_tsgo_payload =
  (): void => {
    const inherited: NodeJS.ProcessEnv = {
      PATH: "/usr/bin",
      [TSGO_ARGS_ENV]: JSON.stringify(["--strict"]),
    };
    clearInheritedTsgoArgs(inherited, undefined);
    assert.equal(inherited[TSGO_ARGS_ENV], undefined);
    assert.equal(inherited.PATH, "/usr/bin");

    const declared: NodeJS.ProcessEnv = {
      [TSGO_ARGS_ENV]: JSON.stringify(["--strict"]),
    };
    clearInheritedTsgoArgs(declared, {
      [TSGO_ARGS_ENV]: JSON.stringify(["--strict"]),
    });
    assert.equal(declared[TSGO_ARGS_ENV], JSON.stringify(["--strict"]));

    const absent: NodeJS.ProcessEnv = { PATH: "/usr/bin" };
    clearInheritedTsgoArgs(absent, undefined);
    assert.deepEqual(absent, { PATH: "/usr/bin" });

    const inheritedConfig: NodeJS.ProcessEnv = {
      [SEMANTIC_CONFIG_PATH_ENV]: "/outer/tsconfig.json",
    };
    clearInheritedSemanticConfigPath(inheritedConfig, undefined);
    assert.equal(inheritedConfig[SEMANTIC_CONFIG_PATH_ENV], undefined);

    const declaredConfig: NodeJS.ProcessEnv = {
      [SEMANTIC_CONFIG_PATH_ENV]: "/project/tsconfig.json",
    };
    clearInheritedSemanticConfigPath(declaredConfig, {
      [SEMANTIC_CONFIG_PATH_ENV]: "/project/tsconfig.json",
    });
    assert.equal(
      declaredConfig[SEMANTIC_CONFIG_PATH_ENV],
      "/project/tsconfig.json",
    );
  };
