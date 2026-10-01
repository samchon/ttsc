import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  buildSourcePlugin,
  fs,
  os,
  path,
} from "../../internal/source-build-unit";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored buildSourcePlugin with a text-file source and requires the precise package-directory/go.mod admission diagnostic, before any toolchain or producer is resolved.
 * @evidence contracts/testing.md#independent-expectations A plugin source must name a Go package directory or go.mod; a plain text file is independently outside that supported input contract.
 * @evidence contracts/testing.md#distinguishing-cases The file-source negative owns early target rejection; valid directory/go.mod and actual cold builds remain owned by the real native workspace/module cases.
 * @evidence contracts/testing.md#execution-ownership test_buildsourceplugin_rejects_non_directory_and_non_go_mod_sources is the named src/features/source-plugin entry; the production target admission precedes Go compiler resolution and returns by throwing, so the direct filesystem fixture executes no installation, Go build or product host.
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
