import {
  assert,
  buildSourcePlugin,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin rejects non-directory and non-go.mod sources.
 *
 * This ttsc source plugin scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_buildsourceplugin_rejects_non_directory_and_non_go_mod_sources =
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
    const source = path.join(root, "plugin.txt");
    fs.writeFileSync(source, "not a Go package\n", "utf8");

    assert.throws(
      () =>
        buildSourcePlugin({
          baseDir: root,
          pluginName: "bad-source",
          source,
          ttscVersion: "1.0.0",
          tsgoVersion: "7.0.0-dev",
        }),
      /Go package directory or go\.mod file/,
    );
  };
