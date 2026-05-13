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
 * This ttsc source plugin scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_buildsourceplugin_rejects_a_source_outside_a_nearby_go_module =
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
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
