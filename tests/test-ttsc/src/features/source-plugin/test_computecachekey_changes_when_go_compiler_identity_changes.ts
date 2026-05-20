import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies computeCacheKey changes when Go compiler identity changes.
 *
 * A plugin binary built with one version of the Go compiler is not compatible
 * with a binary built by a different version. The cache key must include a
 * content fingerprint of the `go` executable so upgrading the toolchain
 * produces a fresh binary slot in the global plugin cache.
 *
 * 1. Create one source plugin and two fake Go executables with different content.
 * 2. Compute the cache key with each executable as `goBinary`.
 * 3. Assert the keys differ.
 */
export const test_computecachekey_changes_when_go_compiler_identity_changes =
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
    const goA = path.join(root, "go-a");
    const goB = path.join(root, "go-b");
    fs.writeFileSync(goA, "go compiler a\n", "utf8");
    fs.writeFileSync(goB, "go compiler b\n", "utf8");

    const first = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: goA,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    const second = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: goB,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.notEqual(first, second);
  };
