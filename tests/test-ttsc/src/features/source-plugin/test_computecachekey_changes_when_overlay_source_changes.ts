import { TestProject } from "../../../../utils/src/TestProject";
import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../internal/source-build-unit";

/**
 * Verifies computeCacheKey changes when overlay source changes.
 *
 * Overlay directories supply ttsc-managed shim sources that are merged into the
 * plugin workspace at build time. If an overlay file changes (e.g. after a ttsc
 * upgrade), the cached binary is stale even if the plugin source itself is
 * unchanged. The cache key must fingerprint overlay contents.
 *
 * 1. Create a source plugin and an overlay directory with one Go file.
 * 2. Compute the cache key, then modify the overlay file.
 * 3. Assert the cache key changes.
 *
 * @evidence contracts/testing.md#behavioral-verification Changing only overlay host.go Value moves the key while plugin source and compiler versions stay fixed.
 * @evidence contracts/testing.md#independent-expectations Overlay Go sources participate in the linked binary, so changing only their Value must change artifact identity.
 * @evidence contracts/testing.md#distinguishing-cases The plugin source, overlay list and compiler versions stay identical while one overlay constant moves from 1 to 2, so a key that ignored overlay contents would collide.
 * @evidence contracts/testing.md#execution-ownership A unit test calling computeCacheKey directly on a temp Go module with no goBinary and no go.mod replace directive, so no Go process is spawned and no native build or consumer host is involved.
 */
export function test_computecachekey_changes_when_overlay_source_changes() {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  const overlay = path.join(root, "overlay");
  const fixture = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "ttsc",
    "test",
    "fixtures",
    "unit",
    "computecachekey_changes_when_overlay_source_changes",
  );
  TestProject.copyDirectory(path.join(fixture, "inputs-1"), root);
  fs.renameSync(path.join(plugin, "main.go.txt"), path.join(plugin, "main.go"));
  fs.renameSync(
    path.join(overlay, "host.go.txt"),
    path.join(overlay, "host.go"),
  );
  assert.equal(
    fs.readFileSync(path.join(plugin, "go.mod"), "utf8"),
    "module example.com/plugin\n\ngo 1.26\n",
  );
  assert.equal(
    fs.readFileSync(path.join(plugin, "main.go"), "utf8"),
    "package main\n",
  );
  assert.equal(
    fs.readFileSync(path.join(overlay, "go.mod"), "utf8"),
    "module example.com/overlay\n\ngo 1.26\n",
  );
  const overlayFile = path.join(overlay, "host.go");
  assert.equal(
    fs.readFileSync(overlayFile, "utf8"),
    "package overlay\nconst Value = 1\n",
  );

  const first = computeCacheKey({
    dir: plugin,
    entry: ".",
    env: {},
    overlayDirs: [overlay],
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  fs.copyFileSync(
    path.join(fixture, "inputs-2", "overlay", "host.go.txt"),
    overlayFile,
  );
  assert.equal(
    fs.readFileSync(overlayFile, "utf8"),
    "package overlay\nconst Value = 2\n",
  );
  const second = computeCacheKey({
    dir: plugin,
    entry: ".",
    env: {},
    overlayDirs: [overlay],
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });

  assert.notEqual(first, second);
}
