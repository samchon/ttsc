import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Verifies a JavaScript CommonJS module an ESM import reaches keeps Node's own
 * `require` under ttsx and `ttsc/register`.
 *
 * Once any `module.registerHooks` load hook exists, Node 22 evaluates every
 * CommonJS module an ESM import reaches with a narrower `require`: no
 * `require.cache`, `require.extensions` or `require.resolve.paths`, and a
 * `require()` of TypeScript that failed (samchon/ttsc#1570). ttsx now hands
 * such a module to the CommonJS loader through the facade where the runtime
 * would narrow it, with the names Node's static detection gives an importer,
 * re-exports included.
 *
 * 1. Give an ESM project a `.cjs` module that requires a TypeScript sibling by its
 *    source and its `.js` spelling and uses the `require` properties, and a
 *    second `.cjs` that re-exports it.
 * 2. Import both from a TypeScript entry, by default and by name.
 * 3. Run the entry through ttsx and through `node --import ttsc/register`.
 * 4. Assert both runs see Node's ordinary `require` and every export.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ESM imports a JavaScript CommonJS module and its re-export under ttsx and --import register; exact JSON proves ordinary require properties and both typed source spellings.
 * @evidence contracts/testing.md#independent-expectations The literal object,object,function properties and from-ts exports come from ordinary Node require and authored fixture values, not product capability predicates.
 * @evidence contracts/testing.md#distinguishing-cases Default import, named import, re-export and .ts versus .js source spellings share the same consumer; absent require properties would fail before successful output.
 * @evidence contracts/testing.md#execution-ownership This named filename-matching E2E entry runs the real built launcher or public register and native host. Portable option/cache decisions stay in source units; recursive main24 and the explicit Node compatibility directory both select this actual boundary.
 * @evidence contracts/e2e.md#necessary-boundary Actual ESM imports a JavaScript CommonJS module and its re-export under ttsx and --import register; exact JSON proves ordinary require properties and both typed source spellings. Direct source calls cannot prove this NativeNode loader or process connection.
 * @evidence contracts/e2e.md#shared-execution One immutable fixture graph serves two necessary public bootstraps; each starts a host because CLI execution and direct register installation connect differently.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Deleting the plain.cjs require-cache entry is confined to that host; separate process state prevents the second bootstrap from inheriting loaded modules.
 * @evidence contracts/e2e.md#preserved-coverage All original meaningful status, output and state assertions remain in this named entry; physical directory selection removes only repeated unrelated portable cases from floor/current execution, while main24 retains the entire runtime population.
 */
export function test_ttsx_gives_a_javascript_commonjs_module_an_import_reaches_nodes_require() {
  const root = TestProject.createProject({
    "package.json": `{ "type": "module", "private": true }\n`,
    "tsconfig.json": TestProject.tsconfig(
      {
        target: "ES2022",
        module: "nodenext",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      { include: ["*.ts", "*.d.cts"] },
    ),
    "shared.ts": `export const value: string = "from-ts";\n`,
    "plain.cjs": `module.exports = { plain: 1 };\n`,
    "lib.cjs": [
      `const shared = require("./shared.ts").value;`,
      `const spelled = require("./shared.js").value;`,
      `delete require.cache[require.resolve("./plain.cjs")];`,
      `exports.value = [shared, spelled].join(",");`,
      `exports.properties = [typeof require.cache, typeof require.extensions, typeof require.resolve.paths].join(",");`,
      ``,
    ].join("\n"),
    "lib.d.cts": `export declare const value: string;\nexport declare const properties: string;\n`,
    "again.cjs": `module.exports = require("./lib.cjs");\n`,
    "again.d.cts": `export * from "./lib.cjs";\n`,
    "entry.ts": [
      `import lib from "./lib.cjs";`,
      `import { properties } from "./lib.cjs";`,
      `import { value } from "./again.cjs";`,
      `console.log(JSON.stringify({ properties, value, whole: lib.value }));`,
      ``,
    ].join("\n"),
  });
  const expected = {
    properties: "object,object,function",
    value: "from-ts,from-ts",
    whole: "from-ts,from-ts",
  };

  const ttsx = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "entry.ts"],
    { cwd: root },
  );
  assert.equal(ttsx.status, 0, ttsx.stderr);
  assert.deepEqual(JSON.parse(ttsx.stdout.trim()), expected);

  const register = TestProject.spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages",
          "ttsc",
          "lib",
          "register.js",
        ),
      ).href,
      "entry.ts",
    ],
    { cwd: root },
  );
  assert.equal(register.status, 0, register.stderr);
  assert.deepEqual(JSON.parse(register.stdout.trim()), expected);
}
