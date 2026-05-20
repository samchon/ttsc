import { TestProject } from "@ttsc/testing";

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
 * Plugin descriptors may accidentally point `source` at a file rather than a Go
 * package directory or a `go.mod` file. The builder must validate the path
 * early and throw a descriptive error rather than passing an invalid path to
 * `go build`.
 *
 * 1. Create a plain text file as the source path.
 * 2. Call `buildSourcePlugin` with that file path.
 * 3. Assert it throws an error matching `Go package directory or go.mod file`.
 */
export const test_buildsourceplugin_rejects_non_directory_and_non_go_mod_sources =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
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
