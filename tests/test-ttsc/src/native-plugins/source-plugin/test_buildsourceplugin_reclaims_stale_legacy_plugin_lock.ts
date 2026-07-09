import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  path,
  resolveSourceBuildCachePaths,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin reclaims stale legacy plugin locks.
 *
 * A killed 0.18.0 source-plugin build can leave `<cache-key>.lock` without a
 * published binary or owner metadata. Waiting ten silent minutes makes the CLI
 * look wedged, so ttsc must recognize an old metadata-less lock as abandoned
 * and retry the build under a fresh lock.
 *
 * 1. Create a source-plugin cache entry with an old `.lock` directory and no
 *    binary.
 * 2. Run `buildSourcePlugin` through the fake Go toolchain.
 * 3. Assert the plugin binary is published and the stale lock is removed.
 */
export const test_buildsourceplugin_reclaims_stale_legacy_plugin_lock = () => {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  writePluginSource(plugin);
  const cacheDir = path.join(root, "cache");

  const fakeGo = createFakeGoBinary(root);
  const saved = {
    go: process.env.TTSC_GO_BINARY,
    cache: process.env.TTSC_CACHE_DIR,
    goCache: process.env.TTSC_GO_CACHE_DIR,
    gocache: process.env.GOCACHE,
  };
  process.env.TTSC_GO_BINARY = fakeGo;
  delete process.env.TTSC_CACHE_DIR;
  delete process.env.TTSC_GO_CACHE_DIR;
  delete process.env.GOCACHE;
  try {
    const key = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: fakeGo,
      overlayDirs: [],
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    const paths = resolveSourceBuildCachePaths(root, cacheDir);
    const cacheEntry = path.join(paths.pluginRoot, key);
    const lockDir = `${cacheEntry}.lock`;
    fs.mkdirSync(cacheEntry, { recursive: true });
    fs.mkdirSync(lockDir, { recursive: true });
    const old = new Date(Date.now() - 120_000);
    fs.utimesSync(lockDir, old, old);

    const binary = buildSourcePlugin({
      baseDir: root,
      cacheDir,
      overlayDirs: [],
      pluginName: "stale-lock",
      source: plugin,
      quiet: true,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.equal(fs.existsSync(binary), true);
    assert.equal(fs.existsSync(lockDir), false);
  } finally {
    restore("TTSC_GO_BINARY", saved.go);
    restore("TTSC_CACHE_DIR", saved.cache);
    restore("TTSC_GO_CACHE_DIR", saved.goCache);
    restore("GOCACHE", saved.gocache);
  }
};

function writePluginSource(root: string): void {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(root, "main.go"), "package main\n", "utf8");
  for (const file of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "package main\n", "utf8");
  }
}

function restore(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
