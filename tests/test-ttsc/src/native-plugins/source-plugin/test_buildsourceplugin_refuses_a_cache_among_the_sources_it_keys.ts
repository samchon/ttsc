import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies a plugin build refuses a cache that lies among the sources its key
 * digests, and accepts one below a directory the sources never include.
 *
 * A build writes its binary, its lock, and Go's objects below its caches. A
 * cache inside a keyed source directory therefore changes the source while the
 * build runs, so the binary can never be published under the key it was built
 * for (samchon/ttsc#1505) and each later build keys a new state. The build says
 * so before it starts. The default cache sits in `node_modules`, which the
 * sources never include, and so does any cache placed there.
 *
 * 1. Build a plugin whose explicit cache is a directory of its own module: the
 *    build fails naming the cache and the module, and nothing is written there.
 * 2. Build it with its Go build cache there instead: the same refusal.
 * 3. Build it with both caches below the module's `node_modules`: it succeeds.
 */
export const test_buildsourceplugin_refuses_a_cache_among_the_sources_it_keys =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-cache-in-source-");
    const plugin = path.join(root, "plugin");
    write(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
    );
    write(path.join(plugin, "main.go"), "package main\n");
    // The files the fake Go build requires of the module it compiles.
    for (const relative of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ])
      write(path.join(plugin, relative), "package generated\n");
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const goBinary = createFakeGoBinary(fakeGo);
    const outside = path.join(root, "outside");
    const build = (cacheDir: string, goCacheDir: string): string =>
      buildSourcePlugin({
        baseDir: root,
        cacheDir,
        env: {
          ...process.env,
          TTSC_GO_BINARY: goBinary,
          TTSC_GO_CACHE_DIR: goCacheDir,
        },
        overlayDirs: [],
        pluginName: "cache-in-source",
        quiet: true,
        source: plugin,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
    const refused = (cache: string) => (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return (
        message.includes(`the cache ${cache} lies inside the plugin source`) &&
        message.includes(plugin)
      );
    };

    // 1. The plugin cache inside the module.
    const pluginCache = path.join(plugin, "cache");
    assert.throws(
      () => build(pluginCache, path.join(outside, "go")),
      refused(pluginCache),
    );
    assert.equal(fs.existsSync(pluginCache), false, "nothing was written there");

    // 2. The Go build cache inside the module.
    const goCache = path.join(plugin, "go-cache");
    assert.throws(
      () => build(path.join(outside, "plugins"), goCache),
      refused(goCache),
    );

    // 3. Both below the module's node_modules, which the sources never include.
    const binary = build(
      path.join(plugin, "node_modules", ".cache", "plugins"),
      path.join(plugin, "node_modules", ".cache", "go"),
    );
    assert.ok(fs.existsSync(binary), binary);
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
