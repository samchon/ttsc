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
 * This ttsc source plugin scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_computecachekey_changes_when_overlay_source_changes = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
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
