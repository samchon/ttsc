import { TestProject } from "@ttsc/testing";
import { spawnSync } from "node:child_process";

import { spawnGoTool } from "../../../../../packages/ttsc/lib/plugin/internal/source/spawnGoTool.js";
import { assert, path } from "../../internal/source-build";

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
