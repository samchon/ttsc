import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin reuses the cache by content key across roots.
 *
 * The cache is keyed by plugin CONTENT, not path, which is exactly why a split
 * CI job that restores one shared cache directory never re-pays a cold build:
 * two byte-identical plugin trees under different project roots resolve to the
 * same cached binary. Pins that invariant against a shared `TTSC_CACHE_DIR`.
 *
 * 1. Point `TTSC_CACHE_DIR` at one isolated cache directory.
 * 2. Build two identical source trees from two different project roots.
 * 3. Assert both builds return the same cached binary under that directory.
 */
export const test_buildsourceplugin_reuses_cache_by_content_key_across_roots =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const cacheDir = path.join(root, "shared-cache");
    const first = path.join(root, "project-a", "plugin");
    const second = path.join(root, "project-b", "plugin");
    writePluginSource(first);
    writePluginSource(second);

    const fakeGo = createFakeGoBinary(root);
    const saved = {
      go: process.env.TTSC_GO_BINARY,
      cache: process.env.TTSC_CACHE_DIR,
      goCache: process.env.TTSC_GO_CACHE_DIR,
      gocache: process.env.GOCACHE,
    };
    process.env.TTSC_GO_BINARY = fakeGo;
    process.env.TTSC_CACHE_DIR = cacheDir;
    // Isolate the Go cache overrides so the shared TTSC_CACHE_DIR alone decides
    // the resolved paths, matching the sibling default-cache test.
    delete process.env.TTSC_GO_CACHE_DIR;
    delete process.env.GOCACHE;
    try {
      const firstBinary = buildSourcePlugin({
        baseDir: path.dirname(first),
        overlayDirs: [],
        pluginName: "shared-cache",
        source: first,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
      const secondBinary = buildSourcePlugin({
        baseDir: path.dirname(second),
        overlayDirs: [],
        pluginName: "shared-cache",
        source: second,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      assert.equal(firstBinary, secondBinary);
      assert.equal(
        firstBinary.startsWith(path.join(cacheDir, "plugins")),
        true,
        firstBinary,
      );
    } finally {
      restore("TTSC_GO_BINARY", saved.go);
      restore("TTSC_CACHE_DIR", saved.cache);
      restore("TTSC_GO_CACHE_DIR", saved.goCache);
      restore("GOCACHE", saved.gocache);
    }
  };

function restore(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

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
