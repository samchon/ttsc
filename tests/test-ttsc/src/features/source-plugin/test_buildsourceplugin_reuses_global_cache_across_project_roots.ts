import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin reuses global cache across project roots.
 *
 * Independent pnpm installs can expose the same plugin source through different
 * project-local paths. The default cache must be keyed by content, so two
 * equivalent source trees under different roots resolve to the same cached
 * binary.
 *
 * 1. Point XDG_CACHE_HOME at an isolated temp directory.
 * 2. Build two identical source-plugin trees from different project roots.
 * 3. Assert both builds return the same global cache binary path.
 */
export const test_buildsourceplugin_reuses_global_cache_across_project_roots =
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
    const cacheHome = path.join(root, "cache-home");
    const first = path.join(root, "project-a", "plugin");
    const second = path.join(root, "project-b", "plugin");
    writePluginSource(first);
    writePluginSource(second);

    const fakeGo = createFakeGoBinary(root);
    const previousGo = process.env.TTSC_GO_BINARY;
    const previousCacheHome = process.env.XDG_CACHE_HOME;
    process.env.TTSC_GO_BINARY = fakeGo;
    process.env.XDG_CACHE_HOME = cacheHome;
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
        firstBinary.startsWith(path.join(cacheHome, "ttsc", "plugins")),
        true,
      );
    } finally {
      if (previousGo === undefined) delete process.env.TTSC_GO_BINARY;
      else process.env.TTSC_GO_BINARY = previousGo;
      if (previousCacheHome === undefined) delete process.env.XDG_CACHE_HOME;
      else process.env.XDG_CACHE_HOME = previousCacheHome;
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
