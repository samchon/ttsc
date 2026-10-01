import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import { STANDARD_DECORATOR_OUTPUT, STANDARD_DECORATOR_SOURCE } from "../../../internal/ttsc/internal/ttsx-decorators";

/**
 * Verifies decorated orphan and owned barrels share one native export connection.
 *
 * Portable lexical and scope permutations execute directly in source units.
 * This host retains the real native decorator emit and facade-linking chain,
 * including conditional execution and exact inert helper text.
 *
 * 1. Prepare one decorated CommonJS orphan re-exporting an owned nested barrel.
 * 2. Dynamically import it from the ESM consumer in one native host.
 * 3. Assert real named/default values, unchanged template text and absent hidden/ghost execution.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx lowers the decorated orphan and project-owned barrel, then NativeNode links the ESM facade; exact decorator output, actual 17 through both named/default routes, both exact template values and false ghost/hidden properties observe the whole chain.
 * @evidence contracts/testing.md#independent-expectations Authored decorator replacement prints the shared literal witness, owned nested actual is 17, helper-shaped templates are inert data and false conditions cannot load deliberately throwing hidden/ghost modules.
 * @evidence contracts/testing.md#distinguishing-cases The orphan uses the real tslib member helper inside an IIFE and the owned middle uses compiler-lowered inline star metadata; both contain backtick regex and division beside real re-exports; inline/member template lookalikes and false unbraced helper are negative connections. All top/block/IIFE/static and lexical permutations additionally have exact metadata and independent native-execution source-unit oracles.
 * @evidence contracts/testing.md#execution-ownership This matching named E2E entry runs one actual launcher/Node consumer and real native compiler preparations for one root, one decorated orphan and one dependency-owned program plus the real immutable tslib helper package; fixture modules are input, not hidden test hosts.
 * @evidence contracts/e2e.md#necessary-boundary Source metadata and prepared-body units cannot prove compiler-emitted decorator code, dependency-owned emit selection and NativeNode named/default facade linking agree; this one consumer exercises that distinct assembly.
 * @evidence contracts/e2e.md#shared-execution Former regex 6, helper-template 2, conditional 1 and nested-scope 8 preparations transfer portable distinctions to source units and share this single orphan/owned-barrel/consumer chain instead of installing or compiling a project per input shape.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One immutable graph owns distinct entry/nested/throwing modules and both template values; no mutated source or warm-cache transition is collapsed. Synchronous spawn ends the host and TestProject owns its directories.
 * @evidence contracts/e2e.md#preserved-coverage Original decorator output, actual 17 through ESM/default, exact inline/member template text and false ghost/hidden observations remain in this host. test_commonjs_export_metadata_distinguishes_scopes_and_inert_syntax owns every scope/regex/division/inert metadata branch; test_commonjs_preparation_preserves_star_helper_execution_and_inert_text owns independent native versus prepared behavior for those shapes, computed exports and false-branch execution.
 */
export function test_ttsx_decorated_barrels_share_native_export_and_inert_text_connections(): void {
  const inlineText = '\n__exportStar(require("./ghost"), exports);\n';
  const memberText = '\ntslib_1.__exportStar(require("./ghost"), exports);\n';
  const root = TestProject.createProject({
    "package.json": '{"type":"module"}',
    "tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "esnext", rootDir: "src", outDir: "dist" }),
    "src/main.ts": 'const name: string = "dep"; const dep = await import(name); console.log(JSON.stringify({ actual: dep.actual, defaultActual: dep.default.actual, inlineText: dep.inlineText, memberText: dep.memberText, ghost: Object.hasOwn(dep, "ghost") || Object.hasOwn(dep.default, "ghost"), hidden: Object.hasOwn(dep.default, "hidden") })); export {};',
    "node_modules/dep/package.json": '{"name":"dep","type":"commonjs","exports":"./index.ts"}',
    "node_modules/dep/index.ts": STANDARD_DECORATOR_SOURCE + 'const marker = /`/; const ratio = 8 / 2 / 2;\nimport * as tslib from "tslib";\ndeclare function require(name: string): any; declare const exports: any;\n(function(){ tslib.__exportStar(require("./values/entry"), exports); })();\nif (false) tslib.__exportStar(require("./hidden"), exports);',
    "node_modules/dep/hidden.ts": 'throw new Error("must-not-execute"); export const hidden = 42;',
    "node_modules/dep/values/tsconfig.json": TestProject.tsconfig({ target: "ES2022", module: "commonjs", rootDir: ".", outDir: "lib" }, { include: ["*.ts"] }),
    "node_modules/dep/values/entry.ts": 'const marker = /`/; const ratio = 8 / 2 / 2;\nexport * from "./nested";\nexport const inlineText = `' + inlineText + '`;\nexport const memberText = `' + memberText + '`;',
    "node_modules/dep/values/nested.ts": 'export const actual = 17;',
    "node_modules/dep/values/ghost.ts": 'throw new Error("inert text executed"); export const ghost = 42;',
  });
  const tslibRoot = path.dirname(createRequire(import.meta.url).resolve("tslib/package.json"));
  TestProject.copyDirectory(tslibRoot, path.join(root, "node_modules", "tslib"));
  const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split(/\r?\n/);
  assert.equal(lines.slice(0, -1).join("\n"), STANDARD_DECORATOR_OUTPUT);
  assert.deepEqual(JSON.parse(lines.at(-1)!), { actual: 17, defaultActual: 17, inlineText, memberText, ghost: false, hidden: false });
}
