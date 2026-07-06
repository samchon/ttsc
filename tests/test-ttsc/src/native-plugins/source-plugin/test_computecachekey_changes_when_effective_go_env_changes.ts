import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  os,
  path,
} from "../../internal/source-build";

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
