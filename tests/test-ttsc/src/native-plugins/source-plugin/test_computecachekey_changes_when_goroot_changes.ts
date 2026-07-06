import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies computeCacheKey changes when GOROOT changes.
 *
 * The plugin builder honors a user-provided GOROOT instead of replacing it with
 * the bundled toolchain root. Since that can change the standard library and
 * tools used by `go build`, the shared global cache must keep distinct slots
 * for different GOROOT values.
 *
 * 1. Create one source plugin and one fake Go executable.
 * 2. Compute the cache key with two different GOROOT values.
 * 3. Assert the keys differ.
 */
export const test_computecachekey_changes_when_goroot_changes = () => {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
  const go = path.join(root, "go");
  fs.writeFileSync(go, "go compiler\n", "utf8");

  const previous = process.env.GOROOT;
  try {
    process.env.GOROOT = path.join(root, "go-root-a");
    const first = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: go,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    process.env.GOROOT = path.join(root, "go-root-b");
    const second = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: go,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.notEqual(first, second);
  } finally {
    if (previous === undefined) delete process.env.GOROOT;
    else process.env.GOROOT = previous;
  }
};
