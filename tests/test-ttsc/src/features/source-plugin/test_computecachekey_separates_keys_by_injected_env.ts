import { TestProject } from "../../../../utils/src/TestProject";
import {
  assert,
  computeCacheKey,
  fs,
  path,
} from "../../internal/source-build-unit";

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
 * @evidence contracts/testing.md#behavioral-verification computeCacheKey is called three times on one Go module with injected env objects {GOFLAGS: '-tags=alpha'}, {GOFLAGS: '-tags=beta'} and alpha again: the alpha and beta keys must differ and the repeated alpha call must reproduce the first key.
 * @evidence contracts/testing.md#independent-expectations The programmatic compiler contract uses its injected effective environment; distinct GOFLAGS affect the build while equal effective options denote equivalent input.
 * @evidence contracts/testing.md#distinguishing-cases Alpha versus beta GOFLAGS are the changing property and a repeated alpha is the same-input control; because the only difference between the first two calls is the injected env, the keys prove the argument is consulted. The test does not check that process.env is untouched.
 * @evidence contracts/testing.md#execution-ownership A unit test calling computeCacheKey directly on a temp Go module with no goBinary and no go.mod replace directive, so no Go process is spawned and no native build or consumer host is involved.
 */
export function test_computecachekey_separates_keys_by_injected_env() {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "computecachekey_separates_keys_by_injected_env",
      "inputs-1",
    ),
    root,
  );
  fs.renameSync(path.join(plugin, "main.go.txt"), path.join(plugin, "main.go"));
  assert.equal(
    fs.readFileSync(path.join(plugin, "go.mod"), "utf8"),
    "module example.com/plugin\n\ngo 1.26\n",
  );
  assert.equal(
    fs.readFileSync(path.join(plugin, "main.go"), "utf8"),
    "package main\n",
  );

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
