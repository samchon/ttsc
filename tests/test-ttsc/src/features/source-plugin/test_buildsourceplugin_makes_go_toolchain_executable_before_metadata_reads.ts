import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  ensureExecutableGoToolchain,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies buildSourcePlugin makes the Go toolchain executable before reading
 * go.mod metadata.
 *
 * Npm package extraction can leave bundled Go files without the executable bit
 * set. The source-plugin builder reads `go.mod` metadata via `go mod edit
 * -json` before running `go build`, so the permission fix must happen before
 * any Go command is spawned, not only before the final compile step.
 *
 * 1. Create a plugin source tree with the required standard subdirectories.
 * 2. Write a fake `go` executable with unsafe writable permissions (mode 0o666).
 * 3. Prove a bundled tool is normalized to 0o755, then call `buildSourcePlugin`
 *    and assert only the required owner execute bit is added to the explicitly
 *    selected toolchain.
 * 4. Give the external tool a restrictive executable mode and assert a cache hit
 *    does not widen the user's permissions.
 *
 * @evidence contracts/testing.md#behavioral-verification POSIX permission repair normalizes bundled mode to 0755, adds only owner execute for the selected external tool, builds, then preserves restrictive 0700 on reuse.
 * @evidence contracts/testing.md#independent-expectations POSIX mode bits establish literal 0755, 0766 and 0700 expectations independently of launcher logic.
 * @evidence contracts/testing.md#distinguishing-cases Nonexecutable 0666 external tool and restrictive already-executable 0700 distinguish necessary repair from permission widening; Windows returns before these assertions.
 * @evidence contracts/testing.md#execution-ownership The exported test_buildsourceplugin_makes_go_toolchain_executable_before_metadata_reads entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary buildSourcePlugin passes actual executable arguments, cwd, environment and copied workspace inputs through a child process before publication. The fake Go script can fail or record those inputs independently; it proves build orchestration at this process boundary and does not certify native Go compilation.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Calls that change source, cache ownership, environment or tool permissions retain distinct observations because those are the inputs under test. The fake subprocess fixtures avoid unnecessary native compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage POSIX permission repair normalizes bundled mode to 0755, adds only owner execute for the selected external tool, builds, then preserves restrictive 0700 on reuse. These assertions stay in test_buildsourceplugin_makes_go_toolchain_executable_before_metadata_reads with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_buildsourceplugin_makes_go_toolchain_executable_before_metadata_reads =
  () => {
    if (process.platform === "win32") {
      return;
    }

    const root = TestProject.tmpdir("ttsc-go-mode-");
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

    const fakeGo = createFakeGoBinary(root, { executable: false });
    fs.chmodSync(fakeGo, 0o666);
    ensureExecutableGoToolchain(fakeGo, true);
    assert.equal(fs.statSync(fakeGo).mode & 0o7777, 0o755);
    fs.chmodSync(fakeGo, 0o666);
    const previousGo = process.env.TTSC_GO_BINARY;
    process.env.TTSC_GO_BINARY = fakeGo;
    try {
      const binary = buildSourcePlugin({
        baseDir: root,
        cacheDir: path.join(root, "cache"),
        overlayDirs: [],
        pluginName: "go-mode",
        source: plugin,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
      assert.equal(fs.existsSync(binary), true);
      assert.equal(fs.statSync(fakeGo).mode & 0o7777, 0o766);
      fs.chmodSync(fakeGo, 0o700);
      buildSourcePlugin({
        baseDir: root,
        cacheDir: path.join(root, "cache"),
        overlayDirs: [],
        pluginName: "go-mode",
        source: plugin,
        quiet: true,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
      assert.equal(fs.statSync(fakeGo).mode & 0o7777, 0o700);
    } finally {
      if (previousGo === undefined) delete process.env.TTSC_GO_BINARY;
      else process.env.TTSC_GO_BINARY = previousGo;
    }
  };
