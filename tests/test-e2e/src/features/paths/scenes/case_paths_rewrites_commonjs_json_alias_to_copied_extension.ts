import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/paths plugin: a CommonJS JSON alias is rewritten to the
 * copied JSON file and the output runs.
 *
 * The compiler copies `data.json` into the output. The rewritten `require` must
 * name `./data.json`, not an invented `./data.js`, so the emitted program can
 * load it under Node.
 *
 * 1. Emit the CommonJS project with `resolveJsonModule`.
 * 2. Assert the output requires `./data.json`, no `data.js` exists and the alias
 *    is gone.
 * 3. Run the emitted file and assert it prints the JSON values.
 *
 * @evidence contracts/testing.md#behavioral-verification A real emit must rewrite the JSON alias to the copied data.json, create no data.js and load successfully under Node, printing ttsc:42.
 * @evidence contracts/testing.md#independent-expectations The authored data.json values and the Node module-loading contract establish the printed result and the existence of the copied file independently of the plugin.
 * @evidence contracts/testing.md#distinguishing-cases The CommonJS require spelling with a copied JSON extension is the positive case; an invented .js sibling is the negative; NodeNext import attributes and bundler aliases belong to sibling scenarios.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_paths with the shared workspace; runtime loading proves the emitted specifier resolves, which no path-prediction unit can.
 * @evidence contracts/e2e.md#necessary-boundary Plugin rewriting, compiler JSON copy and the Node loader meet only in a real emitted program.
 * @evidence contracts/e2e.md#shared-execution Its CommonJS module setting differs from the other scenarios' module settings, so it keeps one emit and one Node run inside the shared workspace.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The scenario owns its dist directory and its Node process is joined before the assertion.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former require specifier, copied file, absent data.js, alias absence and runtime output assertions unchanged.
 */
export function case_paths_rewrites_commonjs_json_alias_to_copied_extension(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const scenario = "commonjs-json";
  const result = UtilityWorkspace.emit(workspace, scenario);
  assert.equal(result.status, 0, result.stderr);

  const js = UtilityWorkspace.read(workspace, scenario, "dist/main.js");
  assert.match(js, /require\("\.\/data\.json"\)/);
  assert.doesNotMatch(js, /require\("\.\/data\.js"\)/);
  assert.doesNotMatch(js, /@data/);
  assert.ok(
    UtilityWorkspace.exists(workspace, scenario, "dist/data.json"),
    "dist/data.json must be copied by the compiler",
  );
  assert.ok(
    !UtilityWorkspace.exists(workspace, scenario, "dist/data.js"),
    "no invented dist/data.js sibling may exist",
  );

  const run = TestProject.runNode(
    path.join(UtilityWorkspace.project(workspace, scenario), "dist", "main.js"),
    { cwd: UtilityWorkspace.project(workspace, scenario) },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /ttsc:42/);
}
