import assert from "node:assert/strict";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/paths plugin: under NodeNext, aliases take the output
 * extension of their target module and JSON aliases keep their import attribute.
 *
 * One NodeNext project holds `.mts`, `.cts` and JSON targets. A `.mts` alias
 * must emit `.mjs`, a `.cts` alias `.cjs`, and a JSON alias must stay
 * `data.json`, never an invented `.js` sibling, while its `with { type: "json" }`
 * attribute survives and the JSON file is copied beside the output.
 *
 * 1. Emit the project through the launcher.
 * 2. Assert the ESM and CommonJS consumers and the declaration name `.mjs` and
 *    `.cjs` outputs with no alias text left.
 * 3. Assert the JSON consumer imports `./data.json` with its attribute, the
 *    JSON file was copied and its declaration names no `.js`.
 *
 * @evidence contracts/testing.md#behavioral-verification A real NodeNext emit must rewrite .mts, .cts and JSON aliases to .mjs, .cjs and data.json in JavaScript and declarations, keep the JSON import attribute and copy the JSON file.
 * @evidence contracts/testing.md#independent-expectations Module-kind extension mapping follows TypeScript's documented NodeNext output extensions and the authored sources; expected specifiers are literals, not computed by the plugin.
 * @evidence contracts/testing.md#distinguishing-cases ESM, CommonJS and JSON targets are the three distinct extension outcomes; a stray .js JSON sibling and surviving alias text are negative checks. Bundler JavaScript targets and CommonJS JSON belong to sibling scenarios.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_paths with the shared workspace; extension decisions are observed in real launcher output while pure prediction belongs to Go units.
 * @evidence contracts/e2e.md#necessary-boundary NodeNext resolution, plugin rewriting and compiler JSON copying meet only in a real emit; direct prediction units cannot show the rewritten specifier names an emitted file.
 * @evidence contracts/e2e.md#shared-execution The former extension project and JSON-attribute project use the same module settings, so they share one project and one emit, with the JSON consumer in its own source file.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The scenario writes only its own dist directory and the files of the two inputs have distinct names, so neither input's output can satisfy the other's assertion.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former mjs, cjs, declaration, json specifier, attribute, copy and no-.js-sibling assertions unchanged apart from the renamed JSON consumer file.
 */
export function case_paths_uses_nodenext_extensions_and_json_import_attributes(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const scenario = "nodenext";
  const result = UtilityWorkspace.emit(workspace, scenario);
  assert.equal(result.status, 0, result.stderr);

  const mjs = UtilityWorkspace.read(workspace, scenario, "dist/main.mjs");
  assert.match(mjs, /from "\.\/modules\/message\.mjs"/);
  assert.doesNotMatch(mjs, /@lib\/message/);
  const cjs = UtilityWorkspace.read(workspace, scenario, "dist/require-consumer.cjs");
  assert.match(cjs, /require\("\.\/modules\/constant\.cjs"\)/);
  assert.doesNotMatch(cjs, /@lib\/constant/);
  const dts = UtilityWorkspace.read(workspace, scenario, "dist/main.d.mts");
  assert.match(dts, /import\("\.\/modules\/message\.mjs"\)/);
  assert.doesNotMatch(dts, /@lib\/message/);

  const json = UtilityWorkspace.read(workspace, scenario, "dist/json-main.mjs");
  assert.match(json, /from "\.\/data\.json"/);
  assert.match(json, /type: "json"/);
  assert.doesNotMatch(json, /\.\/data\.js"/);
  assert.doesNotMatch(json, /@data/);
  assert.ok(
    UtilityWorkspace.exists(workspace, scenario, "dist/data.json"),
    "dist/data.json must be copied by the compiler",
  );
  const jsonDts = UtilityWorkspace.read(workspace, scenario, "dist/json-main.d.mts");
  assert.doesNotMatch(jsonDts, /data\.js"/);
}
