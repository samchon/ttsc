import { TestProject } from "../../../../utils/src/TestProject";

import { assert, computeCacheKey, fs, path } from "../../internal/source-build-unit";

/**
 * Verifies computeCacheKey separates cache keys by its injected `env` argument,
 * independently of `process.env`.
 *
 * A programmatic `TtscCompiler` passes its effective instance environment (`{
 * ...process.env, ...context.env }`) into the source-build cache key so two
 * instances that pin different Go build variables never reuse one another's
 * plugin binaries. The key must fold in the passed `env`, not the ambient
 * `process.env`; otherwise instances with contradictory `context.env` collide
 * on one cache entry.
 *
 * Transformation direction with a boundary twin: two `env` objects differing
 * only in `GOFLAGS` must yield different keys, while a repeat with an identical
 * `env` must yield the same key. Neither call touches `process.env` or spawns a
 * Go toolchain, so the difference can only come from the injected argument.
 *
 * 1. Compute the key for a plugin source with `env.GOFLAGS = "-tags=alpha"`.
 * 2. Compute it again with `env.GOFLAGS = "-tags=beta"`, then a third time
 *    re-using the first `env`.
 * 3. Assert the first two differ and the first and third match.
 *
 * @evidence contracts/testing.md#behavioral-verification Contradictory GOFLAGS alpha/beta must differ without mutating ambient process.env; repeating alpha must reproduce its key.
 * @evidence contracts/testing.md#independent-expectations The programmatic compiler contract uses its injected effective environment; distinct GOFLAGS affect the build while equal effective options denote equivalent input.
 * @evidence contracts/testing.md#distinguishing-cases GOFLAGS -tags=alpha and -tags=beta yield different keys while a repeated alpha reproduces its key, and the ambient process.env is never read or changed.
 * @evidence contracts/testing.md#execution-ownership This matching named source-unit entry directly executes the authored hashing owner over fixture bytes without a Go executable, native artifact or consumer host; actual build and toolchain probes remain separate boundaries.
 */
export function test_computecachekey_separates_keys_by_injected_env() {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");

  const alphaEnv: NodeJS.ProcessEnv = { GOFLAGS: "-tags=alpha" };
  const betaEnv: NodeJS.ProcessEnv = { GOFLAGS: "-tags=beta" };

  const alpha = computeCacheKey({
    dir: plugin,
    entry: ".",
    env: alphaEnv,
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  const beta = computeCacheKey({
    dir: plugin,
    entry: ".",
    env: betaEnv,
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  const alphaAgain = computeCacheKey({
    dir: plugin,
    entry: ".",
    env: alphaEnv,
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });

  assert.notEqual(alpha, beta);
  assert.equal(alpha, alphaAgain);
}
