import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  path,
  resolveSourceBuildCachePaths,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin: marks an empty default cache boundary.
 *
 * A source-plugin build can be the first writer below an intentionally empty
 * nested `node_modules`. Its cache write must not make the next resolution
 * abandon that install for a populated ancestor.
 *
 * 1. Create a plugin below an empty install and a populated ancestor install.
 * 2. Build it through the fake Go toolchain with the default cache.
 * 3. Assert cache resolution retains the nested root after the cache write.
 */
export const test_buildsourceplugin_marks_an_empty_default_cache_boundary =
  () => {
    const container = TestProject.tmpdir("ttsc-empty-cache-boundary-");
    const root = path.join(container, "project");
    fs.mkdirSync(path.join(container, "node_modules", "dependency"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
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
      const location = path.join(root, file);
      fs.mkdirSync(path.dirname(location), { recursive: true });
      fs.writeFileSync(location, "package main\n", "utf8");
    }
    const expected = path.join(root, "node_modules", ".cache", "ttsc");
    assert.equal(resolveSourceBuildCachePaths(root).root, expected);

    const binary = buildSourcePlugin({
      baseDir: root,
      env: {
        ...process.env,
        GOCACHE: "",
        TTSC_CACHE_DIR: "",
        TTSC_GO_BINARY: createFakeGoBinary(container),
        TTSC_GO_CACHE_DIR: "",
      },
      overlayDirs: [],
      pluginName: "empty-cache-boundary",
      quiet: true,
      source: root,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.equal(fs.existsSync(binary), true);
    assert.equal(resolveSourceBuildCachePaths(root).root, expected);
  };
