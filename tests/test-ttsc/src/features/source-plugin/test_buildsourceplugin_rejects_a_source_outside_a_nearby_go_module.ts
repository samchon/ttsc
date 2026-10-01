import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  buildSourcePlugin,
  fs,
  os,
  path,
} from "../../internal/source-build-unit";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored buildSourcePlugin on a deeply nested directory without a nearby module and requires the precise bounded module-discovery failure, without creating a compiler or host.
 * @evidence contracts/testing.md#independent-expectations The source-module admission contract requires go.mod within the permitted parent walk; the fixture deliberately creates none in that path.
 * @evidence contracts/testing.md#distinguishing-cases The missing-module negative owns failed bounded discovery; the valid deep workspace-module native case owns the admitted opposite and actual Go connection.
 * @evidence contracts/testing.md#execution-ownership test_buildsourceplugin_rejects_a_source_outside_a_nearby_go_module is the named src/features/source-plugin entry; the production target admission precedes Go compiler resolution and returns by throwing, so the direct filesystem fixture executes no installation, Go build or product host.
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
