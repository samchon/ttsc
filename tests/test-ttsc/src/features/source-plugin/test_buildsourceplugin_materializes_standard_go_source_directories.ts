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
 *
 * @evidence contracts/testing.md#behavioral-verification buildSourcePlugin succeeds through a fake Go child that refuses missing vendor/lib/dist/build files, then returns an existing publication.
 * @evidence contracts/testing.md#independent-expectations The child independently lists required paths rather than asking the copying implementation which paths to expect.
 * @evidence contracts/testing.md#distinguishing-cases All four conventional source directories must reach the scratch cwd; the copy-every-file case owns unusual entry kinds.
 * @evidence contracts/testing.md#execution-ownership The exported test_buildsourceplugin_materializes_standard_go_source_directories entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary buildSourcePlugin passes actual executable arguments, cwd, environment and copied workspace inputs through a child process before publication. The fake Go script can fail or record those inputs independently; it proves build orchestration at this process boundary and does not certify native Go compilation.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Calls that change source, cache ownership, environment or tool permissions retain distinct observations because those are the inputs under test. The fake subprocess fixtures avoid unnecessary native compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage buildSourcePlugin succeeds through a fake Go child that refuses missing vendor/lib/dist/build files, then returns an existing publication. These assertions stay in test_buildsourceplugin_materializes_standard_go_source_directories with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
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
