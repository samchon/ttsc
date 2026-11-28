import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GoToolResolution } from "../../../../../packages/ttsc/src/plugin/internal/source/GoToolResolution";
import { pluginModuleReplaceDirectories } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginModuleReplaceDirectories";
import { resolveGoCompiler } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveGoCompiler";

/**
 * Verifies local Go replacement selection refuses a raw target before copy.
 *
 * 1. Ask Go to parse a replacement naming a valid UTF-8 path.
 * 2. On Linux, point a declared alias at a separate raw-byte directory.
 * 3. Refuse that target and missing descendants of its raw physical ancestry.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the same maintained replacement reader and native Go parser used by the build before hashing and materializing an external module.
 * @evidence contracts/testing.md#independent-expectations Native fixtures give the real replacement and the valid U+FFFD directory separate filesystem entries. Returned valid selection and exact refusal diagnostics derive from the authored paths.
 * @evidence contracts/testing.md#distinguishing-cases The valid replacement-character directory runs on every host. Linux contrasts its separate raw target and a missing suffix whose existing parent cannot be represented as UTF-8.
 * @evidence contracts/testing.md#execution-ownership The fixture owns its module and temporary files. It runs actual Go metadata acquisition without compiling any plugin or mutating ambient variables.
 */
export function test_go_replacement_rejects_a_lossy_physical_target(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-raw-replacement-")),
  );
  const main = path.join(root, "main");
  const alias = path.join(root, "dependency-alias");
  const twin = path.join(root, "dependency-\ufffd");
  const raw = Buffer.concat([
    Buffer.from(`${root}/dependency-`),
    Buffer.from([0xff]),
  ]);
  const nativeMod = Buffer.concat([raw, Buffer.from("/go.mod")]);
  const dependency = "module example.com/dependency\n\ngo 1.25\n";
  try {
    fs.mkdirSync(main);
    fs.mkdirSync(twin);
    fs.writeFileSync(path.join(twin, "go.mod"), dependency);
    const env = { ...process.env, GOENV: "off", GOTOOLCHAIN: "local" };
    const go = GoToolResolution.resolveGoToolForBuild(
      resolveGoCompiler(env).binary,
      env,
      main,
    );
    const read = (target: string) => {
      fs.writeFileSync(
        path.join(main, "go.mod"),
        `module example.com/main\n\ngo 1.25\n\nreplace example.com/dependency => ${target}\n`,
      );
      return pluginModuleReplaceDirectories(
        main,
        env,
        go,
        undefined,
        undefined,
        undefined,
        root,
      );
    };
    assert.deepEqual(read("../dependency-\ufffd"), [
      {
        directory: twin,
        modulePath: "example.com/dependency",
        spelled: "../dependency-\ufffd",
      },
    ]);
    if (process.platform !== "linux") return;

    fs.mkdirSync(raw);
    fs.writeFileSync(nativeMod, dependency);
    fs.symlinkSync(raw, alias);
    assert.equal(
      fs.readFileSync(path.join(alias, "go.mod"), "utf8"),
      dependency,
    );
    for (const target of ["../dependency-alias", "../dependency-alias/missing"])
      assert.throws(() => read(target), {
        message: `ttsc: local Go replacement has no UTF-8 physical path: ${path.resolve(main, target)}`,
      });
  } finally {
    if (process.platform === "linux") {
      if (fs.existsSync(alias)) fs.unlinkSync(alias);
      if (fs.existsSync(nativeMod)) fs.unlinkSync(nativeMod);
      if (fs.existsSync(raw)) fs.rmdirSync(raw);
    }
    fs.rmSync(root, { recursive: true });
  }
}
