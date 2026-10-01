import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../internal/source-build-unit";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Embedded rules.json bytes are part of the artifact input even though they are not Go source; the unchanged plugin then changed version data must produce distinct keys.
 * @evidence contracts/testing.md#independent-expectations Go embed includes rules.json bytes in the binary, so a different rules version cannot reuse the original artifact even with unchanged Go source.
 * @evidence contracts/testing.md#distinguishing-cases The Go source and entry stay identical while rules.json moves from version 1 to version 2, so a key derived from .go source alone would collide.
 * @evidence contracts/testing.md#execution-ownership A unit test calling computeCacheKey directly on a temp Go module with no goBinary and no go.mod replace directive, so no Go process is spawned and no native build or consumer host is involved.
 */
export function test_computecachekey_changes_when_embedded_data_changes() {
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
}
