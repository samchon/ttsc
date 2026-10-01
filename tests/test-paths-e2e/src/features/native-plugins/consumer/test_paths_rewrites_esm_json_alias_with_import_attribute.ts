import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestPaths } from "../../../internal/TestPaths";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies the @ttsc/paths plugin: an exact `.json` alias keeps the copied
 * extension and its import attribute in ESM emit with declarations.
 *
 * The output-path predictor must name the file TypeScript-Go copies (`.json`),
 * not an invented `.js` sibling, and the rewrite must touch only the specifier
 * text — the `with { type: "json" }` attribute Node requires for ESM JSON stays
 * intact. Declaration emit must likewise never introduce a nonexistent `.js`
 * JSON target. A `.mjs`/`.d.mts` project pins all three under NodeNext.
 *
 * 1. Build a NodeNext `resolveJsonModule` project whose `@data` alias targets
 *    `./src/data.json`, imported with an attribute from `src/main.mts`.
 * 2. Run real `ttsc --emit`.
 * 3. Assert the emitted specifier is `./data.json` with its attribute retained, no
 *    `.js` JSON target appears in the JavaScript or declaration output, and
 *    `dist/data.json` exists.
 *
 * @evidence contracts/testing.md#behavioral-verification NodeNext MJS must reference ./data.json and retain type:json, copied JSON must exist and JS/declaration output must not invent data.js.
 * @evidence contracts/testing.md#independent-expectations JSON copy and ESM import-attribute contracts require the literal .json target with unchanged attribute.
 * @evidence contracts/testing.md#distinguishing-cases Specifier rewrite and retained attribute are independent observations; declaration output forbids a nonexistent JS JSON target.
 * @evidence contracts/testing.md#execution-ownership This named test_paths_rewrites_esm_json_alias_with_import_attribute entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Native rewrite must preserve import attributes through the real MJS serializer and compiler copy publication.
 * @evidence contracts/e2e.md#shared-execution One NodeNext JSON project checks MJS, declarations and copied JSON together; CommonJS require lacks this attribute boundary. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage NodeNext MJS must reference ./data.json and retain type:json, copied JSON must exist and JS/declaration output must not invent data.js. All original assertions remain in this named entry. TestLinkedProgramRewritesModuleSyntaxWithoutChangingOtherLiterals owns eligible syntax, adjacent ordinary literals and lexical require controls in the Go unit population; these emit assertions retain serializer and copied-output responsibility.
 */
export function test_paths_rewrites_esm_json_alias_with_import_attribute() {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
        declaration: true,
        resolveJsonModule: true,
        strict: true,
        rootDir: "src",
        outDir: "dist",
        paths: { "@data": ["./src/data.json"] },
        plugins: [{ transform: "@ttsc/paths" }],
      },
      include: ["src"],
    }),
    "src/data.json": JSON.stringify({ answer: 42 }, null, 2),
    "src/main.mts": [
      `import data from "@data" with { type: "json" };`,
      `export const answer: number = data.answer;`,
      ``,
    ].join("\n"),
  });
  TestPaths.seedPackage(root);

  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestPaths.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);

  const mjs = fs.readFileSync(path.join(root, "dist", "main.mjs"), "utf8");
  assert.match(mjs, /from "\.\/data\.json"/);
  assert.match(mjs, /type: "json"/);
  assert.doesNotMatch(mjs, /\.\/data\.js"/);
  assert.doesNotMatch(mjs, /@data/);

  assert.ok(
    fs.existsSync(path.join(root, "dist", "data.json")),
    "dist/data.json must be copied by the compiler",
  );

  const dts = fs.readFileSync(path.join(root, "dist", "main.d.mts"), "utf8");
  assert.doesNotMatch(dts, /data\.js"/);
}
