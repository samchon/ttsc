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
 * Verifies buildSourcePlugin materializes standard Go source directories.
 *
 * Plugin source trees can organise helper code under `vendor/`, `lib/`,
 * `dist/`, or `build/` subdirectories. `buildSourcePlugin` must copy all of
 * these into the build workspace alongside `go.mod` and root-level `.go` files
 * so `go build` can resolve them without any custom module configuration.
 *
 * 1. Create a plugin source tree with files in each of the four standard
 *    subdirectories.
 * 2. Build the plugin through a fake Go executable that fails if any expected
 *    source file is absent from the working directory.
 * 3. Assert the returned binary path exists (i.e. the fake `go build` succeeded).
 */
export const test_buildsourceplugin_materializes_standard_go_source_directories =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const plugin = path.join(root, "plugin");
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
    for (const file of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      fs.mkdirSync(path.dirname(path.join(plugin, file)), { recursive: true });
      fs.writeFileSync(path.join(plugin, file), "package main\n", "utf8");
    }

    const fakeGo = createFakeGoBinary(root);
    const previousGo = process.env.TTSC_GO_BINARY;
    process.env.TTSC_GO_BINARY = fakeGo;
    try {
      const binary = buildSourcePlugin({
        baseDir: root,
        cacheDir: path.join(root, "cache"),
        overlayDirs: [],
        pluginName: "standard-dirs",
        source: plugin,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
      assert.equal(fs.existsSync(binary), true);
    } finally {
      if (previousGo === undefined) delete process.env.TTSC_GO_BINARY;
      else process.env.TTSC_GO_BINARY = previousGo;
    }
  };
