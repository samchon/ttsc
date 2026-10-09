import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { commonJsExportNames } from "../../../../../packages/ttsc/src/launcher/internal/runtime/commonJsExportNames";

/**
 * Verifies static names against the source module's native require authority.
 *
 * 1. Create real packages with exports/imports conditions and competing output.
 * 2. Scan authored CommonJS bodies without executing their throwing targets.
 * 3. Collect every package, cycle, failure and direct-name assertion.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production scanner on real filesystem packages resolved by Node; observes exact names, target-read counts and propagated source-reader errors without evaluating target code.
 * @evidence contracts/testing.md#independent-expectations Authored require-condition files export literal names distinct from import-condition and private-output decoys. Literal expected sets and one physical read per cycle member are independent of scanner output.
 * @evidence contracts/testing.md#distinguishing-cases Covers bare/scoped/self/imports/exports-subpath resolution, source/output origin, extensionless native main, relative control, existing JS before adjacent TS, source-only emitted bytes, mixed cycles, blocked/missing/builtin/JSON targets, root versus nested default and throwing source-reader ownership errors.
 * @evidence contracts/testing.md#execution-ownership One source unit creates and removes private filesystem inputs, initializes the installed lexer, and directly calls the maintained scanner. Node resolves packages but no target module is evaluated, compiler or host started, consumer installed or foreign loader replaced; all independent cases are collected before failure.
 */
export function test_commonjs_export_names_follow_source_require_resolution(): void {
  const { initSync } = createRequire(
    new URL("../../../../../packages/ttsc/package.json", import.meta.url),
  )("cjs-module-lexer") as { initSync(): void };
  initSync();
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-cjs-names-")),
  );
  const failures: Error[] = [];
  const write = (file: string, text: string) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
    return target;
  };
  const check = (label: string, action: () => void) => {
    try { action(); } catch (error) {
      failures.push(new Error(label, { cause: error }));
    }
  };
  const star = (specifier: string) =>
    `__exportStar(require(${JSON.stringify(specifier)}), exports);`;
  try {
    const source = write("app/barrel.cts", "");
    write("private/barrel.cjs", "");
    write("app/package.json", JSON.stringify({
      name: "self-package",
      imports: { "#leaf": { require: "./import-leaf.cjs", import: "./wrong.cjs" } },
      exports: { "./leaf": { require: "./self-leaf.cjs", import: "./wrong.cjs" } },
    }));
    write("app/import-leaf.cjs", "exports.importsName = 1;");
    write("app/self-leaf.cjs", "exports.selfName = 1;");
    write("app/wrong.cjs", "exports.wrongImport = 1;");
    write("app/relative.cjs", "exports.relative = 1;");
    write("private/relative.cjs", "exports.wrongOutput = 1;");
    write("app/native.js", "exports.nativeJs = 1;");
    write("app/native.ts", "exports.wrongTs = 1;");
    write("app/source.cts", "export const rawTypeScript = 1;");
    write("app/a.cjs", star("./b.cts") + "exports.a = 1;");
    write("app/b.cts", "export const rawCycleTypeScript = 1;");
    const packageRoot = "app/node_modules/package-leaf/";
    write(packageRoot + "package.json", JSON.stringify({
      name: "package-leaf",
      exports: {
        ".": { require: "./require.cjs", import: "./import.cjs" },
        "./mapped": { require: "./mapped.cjs", import: "./import.cjs" },
        "./blocked": null,
      },
    }));
    write(packageRoot + "require.cjs", "exports.packageName = 1; exports.default = 2; throw new Error('must not execute');");
    write(packageRoot + "mapped.cjs", "exports.mapped = 1;");
    write(packageRoot + "import.cjs", "exports.wrongImport = 1;");
    write("app/node_modules/@scope/leaf/package.json", '{"main":"index.cjs"}');
    write("app/node_modules/@scope/leaf/index.cjs", "exports.scoped = 1;");
    write("app/node_modules/extensionless/package.json", '{"main":"entry"}');
    write("app/node_modules/extensionless/entry", "exports.extensionless = 1;");
    write("app/data.json", '{"invented":1}');
    const reads = new Map<string, number>();
    const read = (file: string): string | null => {
      reads.set(file, (reads.get(file) ?? 0) + 1);
      if (file === path.join(root, "app/source.cts")) return "exports.sourceOnly = 1;";
      if (file === path.join(root, "app/b.cts")) return star("./a.cjs") + "exports.b = 1;";
      try { return fs.readFileSync(file, "utf8"); } catch { return null; }
    };
    const scan = (body: string) => commonJsExportNames(body, source, read).sort();
    for (const [label, body, expected] of [
      ["bare", star("package-leaf"), ["packageName"]],
      ["mapped require condition", star("package-leaf/mapped"), ["mapped"]],
      ["scoped", star("@scope/leaf"), ["scoped"]],
      ["self reference", star("self-package/leaf"), ["selfName"]],
      ["imports require condition", star("#leaf"), ["importsName"]],
      ["source origin", star("./relative.cjs"), ["relative"]],
      ["native existing JS", star("./native.js"), ["nativeJs"]],
      ["extensionless main", star("extensionless"), ["extensionless"]],
      ["owned source bytes", star("./source.cts"), ["sourceOnly"]],
      ["mixed cycle", star("./a.cjs"), ["a", "b"]],
      ["unresolved", star("missing-package"), []],
      ["blocked", star("package-leaf/blocked"), []],
      ["builtin", star("node:fs"), []],
      ["JSON", star("./data.json"), []],
      ["root default", "exports.default = 1; exports.own = 2;" + star("package-leaf"), ["default", "own", "packageName"]],
      ["inert", `exports.text = ${JSON.stringify(star("package-leaf"))};`, ["text"]],
      ["empty", "", []],
    ] as const) check(label, () => assert.deepEqual(scan(body), [...expected].sort()));
    check("native blocked authority", () => assert.throws(
      () => createRequire(source).resolve("package-leaf/blocked"),
      { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" },
    ));
    check("cycle reads once", () => {
      reads.clear();
      assert.deepEqual(scan(star("./a.cjs") + star("./a.cjs")), ["a", "b"]);
      assert.equal(reads.get(path.join(root, "app/a.cjs")), 1);
      assert.equal(reads.get(path.join(root, "app/b.cts")), 1);
    });
    check("source reader errors retain ownership", () => {
      const error = new Error("owned source unavailable");
      assert.throws(() => commonJsExportNames(star("./source.cts"), source, () => { throw error; }), (caught) => caught === error);
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  if (failures.length) throw new AggregateError(failures, "CommonJS source require resolution failed");
}
