import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Verifies a JavaScript CommonJS entry run through the ESM loader can require
 * TypeScript under `ttsc/register`.
 *
 * With an `--import` preload, Node runs a `.cjs` entry through its ESM loader.
 * Where the runtime gives that entry a `require` that loads through the ESM
 * loader (Node 22 whenever a load hook exists), a `require()` of TypeScript
 * reached the hooks as an import and was handed back as the ESM facade, which
 * that `require` cannot load, so the entry crashed (samchon/ttsc#1570,
 * samchon/ttsc#1571). A CommonJS module such a `require` asks for is now served
 * to it as CommonJS.
 *
 * 1. Give a CommonJS project a `main.cjs` that requires `./src/dep.js`, backed
 *    only by `dep.ts`, and a nested `dep.ts` that requires another source.
 * 2. Run `node --import <preload> -r ttsc/register main.cjs`.
 * 3. Assert the entry is the main module and both sources ran.
 * @evidence contracts/testing.md#behavioral-verification Real Node --import preload.mjs -r register runs main.cjs and must return JSON {main:true,value:"dep+leaf"} after requiring .js backed by dep.ts and a nested TypeScript leaf.
 * @evidence contracts/testing.md#independent-expectations The authored CommonJS main identity and dependency concatenation define the expected native Node behavior independently of runtime format classification.
 * @evidence contracts/testing.md#distinguishing-cases A JavaScript CJS main passes through an ESM preload yet must keep require.main semantics and load both TypeScript sources as CommonJS; no direct ESM entry is duplicated here.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_lets_a_javascript_entry_under_an_import_preload_require_typescript E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary Node import-preload/require-main dispatch and ttsc register hooks must agree on served module format. Direct classification units cannot prove native require accepts the returned source.
 * @evidence contracts/e2e.md#shared-execution One fixture and one Node host retain the import preload, register and nested source chain. Compiler preparations occur on requested TS ownership; no native plugin producer or per-file host is created.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The empty preload and dependency graph stay immutable; synchronous Node exit ends hooks/runtime owners and TestProject tracks fixture directories.
 * @evidence contracts/e2e.md#preserved-coverage Original status and exact parsed main/value JSON remain. CJS main identity, .js-to-.ts lookup and nested require are preserved as one live connection.
 */
export function test_ttsx_lets_a_javascript_entry_under_an_import_preload_require_typescript() {
    const root = TestProject.commonJsProject({
      "main.cjs": [
        `const dep = require("./src/dep.js");`,
        `console.log(JSON.stringify({ main: require.main === module, value: dep.value }));`,
        ``,
      ].join("\n"),
      "src/dep.ts": [
        `declare const require: any;`,
        `export const value: string = "dep+" + require("./leaf").leaf;`,
        ``,
      ].join("\n"),
      "src/leaf.ts": `export const leaf: string = "leaf";\n`,
      "preload.mjs": ``,
    });
    const result = TestProject.spawn(
      process.execPath,
      [
        "--import",
        pathToFileURL(path.join(root, "preload.mjs")).href,
        "-r",
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages",
          "ttsc",
          "lib",
          "register.js",
        ),
        "main.cjs",
      ],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      main: true,
      value: "dep+leaf",
    });
  }
