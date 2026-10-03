import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  ensureExecutableGoToolchain,
  fs,
  os,
  path,
} from "../../../internal/ttsc/internal/source-build";

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
 * 4. Give the external tool a restrictive executable mode and assert another call
 *    does not widen the user's permissions.
 *
 * @evidence contracts/testing.md#behavioral-verification POSIX permission repair normalizes bundled mode to 0755, adds only owner execute for the selected external tool, builds, then preserves restrictive 0700 on the next request.
 * @evidence contracts/testing.md#independent-expectations POSIX mode bits establish literal 0755, 0766 and 0700 expectations independently of launcher logic.
 * @evidence contracts/testing.md#distinguishing-cases Nonexecutable 0666 external tool and restrictive already-executable 0700 distinguish necessary repair from permission widening; Windows returns before these assertions.
 * Unavailable host capabilities return false so the runner reports SKIPPED without claiming this case executed its behavioral assertions.
 *
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner reaches actual builder subprocess assembly through an authored fake Go evaluator, not native Go compilation. Direct literal mode semantics are authored separately in test-ttsc/source-plugin/test_source_toolchain_permissions_preserve_owned_and_selected_modes.ts; its source body is not runtime or process-order certification.
 * @evidence contracts/e2e.md#necessary-boundary buildSourcePlugin passes actual executable arguments, cwd, environment and copied workspace inputs through a child process before publication. The fake Go script can fail or record those inputs independently; it proves build orchestration at this process boundary and does not certify native Go compilation.
 * @evidence contracts/e2e.md#shared-execution One six-file module/fake tool/root feeds two builder requests with 0666-to-0766 and then 0700 authority. Permission mode changes may require fresh key metadata even if eventual artifact reuse is possible; no invocation count, second binary identity or cache-hit proof is asserted. Wrapper, evaluator and fallback attempts are separate observed populations; no actual Go compile occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked root is retained before source/tool preparation. Exact prior TTSC_GO_BINARY value or absence is restored in finally; other ambient authorities remain actual inputs. Private source/cache/tool spellings isolate this sequence, but synchronous result is not arbitrary descendant join or a cache-hit/zero-spawn certificate.
 * @evidence contracts/e2e.md#preserved-coverage Original bundled0755/external0766/published binary exists/second-call0700, six source files, fake evaluator and Windows returnfalse remain. Direct permission counterpart tests/test-ttsc/src/features/source-plugin/test_source_toolchain_permissions_preserve_owned_and_selected_modes.ts preserves0755/0766/0700 without compiler; source body382f690/COMMENT5396930530 is authored, not surviving execution proof. Builder repair-before-key metadata connection stays here, no cache-hit/actual Go compile certificate. Runtime/selection/survival unverified and donor retained.
 */
export const test_buildsourceplugin_makes_go_toolchain_executable_before_metadata_reads =
  (): void | false => {
    if (process.platform === "win32") {
      return false;
    }

    const root = TestProject.tmpdir("ttsc-go-mode-");
    TestProject.retainTemporaryDirectory(root, "Source toolchain probe descendants are not joined");
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
