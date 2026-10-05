import { TestProject } from "../../../../utils/src/TestProject";
import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../internal/source-build-unit";

/**
 * Verifies computeCacheKey changes when selected embedded rules.json changes.
 *
 * The snapshot policy includes ordinary rules.json data alongside Go source.
 * This unit verifies that changing its bytes changes the key, independently of
 * unchanged Go declarations. It does not cover excluded file names or build an
 * artifact to inspect embedded bytes.
 *
 * 1. Create a plugin with a `//go:embed rules.json` directive.
 * 2. Compute the cache key, then update the embedded file.
 * 3. Assert the cache key changes.
 *
 * @evidence contracts/testing.md#behavioral-verification The selected rules.json data file enters the source digest even though it is not Go source; unchanged declarations and changed version data must produce distinct keys.
 * @evidence contracts/testing.md#independent-expectations The declared snapshot policy includes the authored ordinary rules.json name; different literal rules bytes must distinguish keys even with unchanged Go source. No binary is built by this unit.
 * @evidence contracts/testing.md#distinguishing-cases The Go source and entry stay identical while rules.json moves from version 1 to version 2, so a key derived from .go source alone would collide.
 * @evidence contracts/testing.md#execution-ownership A unit test calling computeCacheKey directly on a temp Go module with no goBinary and no go.mod replace directive, so no Go process is spawned and no native build or consumer host is involved.
 */
export function test_computecachekey_changes_when_embedded_data_changes() {
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
      "computecachekey_changes_when_embedded_data_changes",
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
    'package main\n\nimport _ "embed"\n\n//go:embed rules.json\nvar rules string\n',
  );
  const data = path.join(plugin, "rules.json");
  fs.writeFileSync(data, '{"version":1}\n', "utf8");

  const first = computeCacheKey({
    dir: plugin,
    entry: ".",
    env: {},
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  fs.writeFileSync(data, '{"version":2}\n', "utf8");
  const second = computeCacheKey({
    dir: plugin,
    entry: ".",
    env: {},
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });

  assert.notEqual(first, second);
}
