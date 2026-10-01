import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  os,
  path,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies computeCacheKey changes when effective Go env changes.
 *
 * The shared plugin cache must honor values returned by `go env`, not only
 * variables present in `process.env`. Otherwise a developer-level `go env -w`
 * target tweak could reuse a binary built for another effective Go build
 * environment.
 *
 * 1. Create one source plugin and a fake Go executable that reports `go env`.
 * 2. Compute the cache key with two different effective `GOARM64` values.
 * 3. Assert the keys differ.
 *
 * @evidence contracts/testing.md#behavioral-verification computeCacheKey changes when the child go env result changes GOARM64 from v8.0 to v9.0.
 * @evidence contracts/testing.md#independent-expectations Distinct effective target settings must never select one compiled artifact; the fake metadata producer supplies those literals independently.
 * @evidence contracts/testing.md#distinguishing-cases Ambient target variables need not change because the effective child-reported setting changes; equal-content reuse is covered by identity twins.
 * @evidence contracts/testing.md#execution-ownership The exported test_computecachekey_changes_when_effective_go_env_changes entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The cache identity owner resolves actual tool paths and consumes the Go metadata process result when goBinary is supplied. The handwritten fake producer or intentionally unusable compiler files constrain that connection; these assertions establish identity selection, not native binary compatibility by execution.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. The same source and version inputs remain fixed while the named identity axis changes; each key observes that state through the existing metadata owner, without installing a consumer or compiling a native artifact.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage computeCacheKey changes when the child go env result changes GOARM64 from v8.0 to v9.0. These assertions stay in test_computecachekey_changes_when_effective_go_env_changes with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_computecachekey_changes_when_effective_go_env_changes =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const plugin = path.join(root, "plugin");
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
    const go = createFakeGoBinary(root);

    const previous = process.env.FAKE_GO_ENV_GOARM64;
    try {
      process.env.FAKE_GO_ENV_GOARM64 = "v8.0";
      const first = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      process.env.FAKE_GO_ENV_GOARM64 = "v9.0";
      const second = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      assert.notEqual(first, second);
    } finally {
      if (previous === undefined) delete process.env.FAKE_GO_ENV_GOARM64;
      else process.env.FAKE_GO_ENV_GOARM64 = previous;
    }
  };
