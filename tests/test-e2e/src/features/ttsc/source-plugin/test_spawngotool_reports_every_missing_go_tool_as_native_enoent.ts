import { TestProject } from "@ttsc/testing";
import { spawnSync } from "node:child_process";

import { spawnGoTool } from "../../../../../../packages/ttsc/lib/plugin/internal/source/spawnGoTool.js";
import { assert, path } from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies source plugins: every spelling of a missing Go tool reports the
 * ENOENT Node reports for any missing executable.
 *
 * The plugin builder turns ENOENT into the "Go toolchain was not found" install
 * hint (samchon/ttsc#1432). On Windows a `.cmd` or `.bat` Go wrapper is run
 * through `cmd.exe`, and a missing one used to be spawned directly to keep the
 * native error. Since the CVE-2024-27980 fix, Node refuses a wrapper spawned
 * without a shell with EINVAL before looking for the file, so the hint never
 * appeared. The result must be indistinguishable from Node's own: the code, the
 * platform errno, the syscall, the path, and the arguments, for every way a
 * wrapper can be named.
 *
 * 1. Spawn a missing native executable to read Node's own ENOENT.
 * 2. Run `spawnGoTool` with each missing spelling: a bare name, `.cmd` and `.bat`
 *    in either case, relative, and absolute, with every wrapper extension in
 *    `PATHEXT`.
 * 3. Assert each result matches the native error field by field.
 *
 * @evidence contracts/testing.md#behavioral-verification spawnGoTool returns native ENOENT fields, null status and missing-process pid for every selected absent tool spelling.
 * @evidence contracts/testing.md#independent-expectations Node spawnSync of an absent native executable supplies the independent platform errno/pid reference; literal paths and version argv establish syscall metadata.
 * @evidence contracts/testing.md#distinguishing-cases Windows covers bare/case-varied cmd/bat, relative and absolute names with PATHEXT; POSIX covers bare and absolute missing binaries.
 * @evidence contracts/testing.md#execution-ownership The exported test_spawngotool_reports_every_missing_go_tool_as_native_enoent entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary spawnGoTool meets the operating system executable/wrapper boundary. Captured arguments or Node-native missing-process errors distinguish an incorrect shell selection, quoting or lookup result that a direct argument formatter cannot detect. The Windows wrapper matrix is conditional and ordinary Linux execution does not prove that branch.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. One capture wrapper or native missing-executable reference serves the argument/name matrix; changing lookup inputs needs another spawn, without rebuilding or installing a product host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage spawnGoTool returns native ENOENT fields, null status and missing-process pid for every selected absent tool spelling. These assertions stay in test_spawngotool_reports_every_missing_go_tool_as_native_enoent with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_spawngotool_reports_every_missing_go_tool_as_native_enoent =
  () => {
    const root = TestProject.tmpdir("ttsc-go-missing-tool-");
    const native = spawnSync(path.join(root, "absent-native"), ["version"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const nativeError = native.error as NodeJS.ErrnoException | undefined;
    assert.equal(nativeError?.code, "ENOENT");

    const missing =
      process.platform === "win32"
        ? [
            "missing-go",
            "missing-go.cmd",
            "missing-go.bat",
            "MISSING-GO.CMD",
            "missing-go.BAT",
            ".\\missing-go.cmd",
            path.join(root, "missing-go.cmd"),
            path.join(root, "missing-go.bat"),
          ]
        : ["missing-go", path.join(root, "missing-go")];
    for (const binary of missing) {
      const result = spawnGoTool(binary, ["version"], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, PATH: root, PATHEXT: ".COM;.EXE;.BAT;.CMD" },
        windowsHide: true,
      });
      const error = result.error as NodeJS.ErrnoException | undefined;
      assert.equal(error?.code, "ENOENT", binary);
      assert.equal(error?.errno, nativeError?.errno, binary);
      assert.equal(error?.syscall, `spawnSync ${binary}`, binary);
      assert.equal(error?.path, binary, binary);
      assert.deepEqual(
        (error as { spawnargs?: string[] } | undefined)?.spawnargs,
        ["version"],
        binary,
      );
      assert.equal(result.status, null, binary);
      assert.equal(result.pid, native.pid, binary);
    }
  };
