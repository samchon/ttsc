import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies computeCacheKey changes when embedded data changes.
 *
 * Go plugins that use `//go:embed` bake static data files into their binary. If
 * an embedded file (e.g. a rules database) changes between builds, the cached
 * binary is stale. The cache key must fingerprint embedded data files in
 * addition to `.go` source.
 *
 * 1. Create a plugin with a `//go:embed rules.json` directive.
 * 2. Compute the cache key, then update the embedded file.
 * 3. Assert the cache key changes.
 */
export const test_computecachekey_changes_when_embedded_data_changes = () => {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(plugin, "main.go"),
    'package main\n\nimport _ "embed"\n\n//go:embed rules.json\nvar rules string\n',
    "utf8",
  );
  const data = path.join(plugin, "rules.json");
  fs.writeFileSync(data, '{"version":1}\n', "utf8");

  const first = computeCacheKey({
    dir: plugin,
    entry: ".",
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  fs.writeFileSync(data, '{"version":2}\n', "utf8");
  const second = computeCacheKey({
    dir: plugin,
    entry: ".",
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });

  assert.notEqual(first, second);
};
