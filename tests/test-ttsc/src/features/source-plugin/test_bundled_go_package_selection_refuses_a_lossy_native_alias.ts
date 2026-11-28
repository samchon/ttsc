import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { resolveNativePackagePath } from "../../../../../packages/ttsc/src/compiler/internal/project/resolveNativePackagePath";
import { resolveGoCompiler } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveGoCompiler";

/**
 * Verifies the installed Go package boundary refuses a decoded lookalike.
 *
 * 1. Author the scoped Go package and its normal installed binary layout.
 * 2. On Linux, link the package name to a distinct native byte path.
 * 3. Require the package lookup to refuse that physical target.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises the native package path selected by resolveGoCompiler via its shared resolver, and checks the actual compiler selector still returns an explicit override untouched.
 * @evidence contracts/testing.md#independent-expectations Separate native directories contain the same library-shaped fixtures. The declared package alias and diagnostic supply independent expected paths.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary package lookup and the explicit override run everywhere. A Linux package link distinguishes a raw SDK directory from its UTF-8 lookalike.
 * @evidence contracts/testing.md#execution-ownership The test owns both package trees and their symlink. It resolves the SDK path without executing either Go file.
 */
export function test_bundled_go_package_selection_refuses_a_lossy_native_alias(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-bundled-go-alias-")),
  );
  const scope = path.join(root, "node_modules", "@ttsc");
  const name = `${process.platform}-${process.arch}`;
  const alias = path.join(scope, name);
  const twin = path.join(root, "sdk-\ufffd");
  const raw = Buffer.concat([Buffer.from(`${root}/sdk-`), Buffer.from([0xff])]);
  const native = (suffix: string): Buffer =>
    Buffer.concat([raw, Buffer.from(suffix)]);
  const binary = process.platform === "win32" ? "go.exe" : "go";
  const relative = `bin/go/bin/${binary}`;
  const from = path.join(root, "caller.cjs");
  const specifier = `@ttsc/${name}/${relative}`;
  const resolve = () =>
    resolveNativePackagePath(
      createRequire(from),
      from,
      specifier,
      "bundled Go executable",
    );
  try {
    fs.mkdirSync(path.join(alias, "bin/go/bin"), { recursive: true });
    fs.writeFileSync(path.join(alias, relative), "fixture");
    const override = "caller-path";
    assert.deepEqual(resolveGoCompiler({ TTSC_GO_BINARY: override }), {
      binary: override,
      bundled: false,
    });
    if (process.platform !== "linux") {
      assert.equal(
        fs.realpathSync.native(resolve()),
        path.join(alias, relative),
      );
      return;
    }
    fs.renameSync(alias, twin);
    fs.mkdirSync(native("/bin/go/bin"), { recursive: true });
    fs.writeFileSync(native(`/${relative}`), "fixture");
    fs.symlinkSync(raw, alias);
    assert.throws(resolve, {
      message: `ttsc: bundled Go executable has no UTF-8 physical path: ${path.join(alias, relative)}`,
    });
  } finally {
    if (process.platform === "linux" && fs.existsSync(raw)) {
      if (fs.lstatSync(alias, { throwIfNoEntry: false })?.isSymbolicLink())
        fs.unlinkSync(alias);
      if (fs.existsSync(native(`/${relative}`)))
        fs.unlinkSync(native(`/${relative}`));
      for (const part of ["/bin/go/bin", "/bin/go", "/bin", ""])
        if (fs.existsSync(native(part))) fs.rmdirSync(native(part));
    }
    fs.rmSync(root, { recursive: true });
  }
}
