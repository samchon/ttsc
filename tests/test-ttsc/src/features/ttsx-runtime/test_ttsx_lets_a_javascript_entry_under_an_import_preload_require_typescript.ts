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
 */
export const test_ttsx_lets_a_javascript_entry_under_an_import_preload_require_typescript =
  () => {
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
  };
