import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../internal/source-build";

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
 */
export const test_computecachekey_changes_when_overlay_source_changes = () => {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  const overlay = path.join(root, "overlay");
  fs.mkdirSync(plugin, { recursive: true });
  fs.mkdirSync(overlay, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
  fs.writeFileSync(
    path.join(overlay, "go.mod"),
    "module example.com/overlay\n\ngo 1.26\n",
    "utf8",
  );
  const overlayFile = path.join(overlay, "host.go");
  fs.writeFileSync(overlayFile, "package overlay\nconst Value = 1\n", "utf8");

  const first = computeCacheKey({
    dir: plugin,
    entry: ".",
    overlayDirs: [overlay],
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  fs.writeFileSync(overlayFile, "package overlay\nconst Value = 2\n", "utf8");
  const second = computeCacheKey({
    dir: plugin,
    entry: ".",
    overlayDirs: [overlay],
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });

  assert.notEqual(first, second);
};
