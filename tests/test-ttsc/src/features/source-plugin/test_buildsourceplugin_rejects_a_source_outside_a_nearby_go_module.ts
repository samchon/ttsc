import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin rejects a source outside a nearby Go module.
 *
 * `buildSourcePlugin` walks up at most 3 parent directories from the given
 * source path to find a `go.mod`. If no `go.mod` is found, the plugin source
 * cannot be compiled and ttsc must throw rather than silently producing a
 * broken binary.
 *
 * 1. Create a deeply nested source directory with no `go.mod` anywhere in the
 *    ancestor chain.
 * 2. Call `buildSourcePlugin` with that directory.
 * 3. Assert it throws an error matching `go.mod within 3 parent directories`.
 */
export const test_buildsourceplugin_rejects_a_source_outside_a_nearby_go_module =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const source = path.join(root, "a", "b", "c", "d", "cmd");
    fs.mkdirSync(source, { recursive: true });

    assert.throws(
      () =>
        buildSourcePlugin({
          baseDir: root,
          pluginName: "missing-go-mod",
          source,
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        }),
      /go\.mod within 3 parent directories/,
    );
  };
