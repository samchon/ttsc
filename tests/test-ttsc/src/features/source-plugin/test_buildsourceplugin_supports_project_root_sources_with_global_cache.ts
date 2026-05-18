import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin supports project-root sources with global cache.
 *
 * Locks the default source-plugin cache location. Without an explicit cacheDir
 * or TTSC_CACHE_DIR override, ttsc stores content-addressed binaries in the
 * user cache instead of a package-local node_modules directory.
 *
 * 1. Point XDG_CACHE_HOME at an isolated temp directory.
 * 2. Build a project-root source plugin without an explicit cacheDir.
 * 3. Assert the binary lands under the global ttsc plugin cache.
 */
export const test_buildsourceplugin_supports_project_root_sources_with_global_cache =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const cacheHome = path.join(root, "cache-home");
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

    const fakeGo = createFakeGoBinary(root);
    const previousGo = process.env.TTSC_GO_BINARY;
    const previousCacheHome = process.env.XDG_CACHE_HOME;
    process.env.TTSC_GO_BINARY = fakeGo;
    process.env.XDG_CACHE_HOME = cacheHome;
    try {
      const binary = buildSourcePlugin({
        baseDir: root,
        overlayDirs: [],
        pluginName: "project-root-source",
        source: root,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
      assert.equal(
        binary.startsWith(path.join(cacheHome, "ttsc", "plugins")),
        true,
      );
      assert.equal(fs.existsSync(binary), true);
    } finally {
      if (previousGo === undefined) delete process.env.TTSC_GO_BINARY;
      else process.env.TTSC_GO_BINARY = previousGo;
      if (previousCacheHome === undefined) delete process.env.XDG_CACHE_HOME;
      else process.env.XDG_CACHE_HOME = previousCacheHome;
    }
  };
