import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/paths plugin: only the CommonJS loader is rewritten and
 * every shadowed `require` keeps its authored argument at run time.
 *
 * The identifier spelling alone cannot distinguish the global loader from a
 * parameter, local or imported binding. Changing a shadowed call's argument
 * alters the value the module returns.
 *
 * 1. Emit one NodeNext project with ambient, unbound, parameter, local and imported `require` calls.
 * 2. Assert only the ambient and unbound loaders became `./lib/message.cjs`.
 * 3. Execute the emitted modules and assert the exact result array.
 *
 * @evidence contracts/testing.md#behavioral-verification The emitted loader and unbound modules require ./lib/message.cjs while the parameter, local and imported bindings keep @lib/message, and Node then returns the exact five-element array.
 * @evidence contracts/testing.md#independent-expectations Lexical binding semantics and the .cts to .cjs output suffix fix the expected specifiers and the literal runtime array; no paths helper computes them.
 * @evidence contracts/testing.md#distinguishing-cases Ambient and unbound loaders change, parameter, local and imported bindings must not, and the executed results distinguish a rewritten shadow from a preserved one.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_utilities with the shared workspace; the compiler emit and the Node child both run to completion in the scenario directory.
 * @evidence contracts/e2e.md#necessary-boundary The native rewrite, emitted files and the Node module loader meet here; in-process assertions on emitted text cannot show that the published program still executes the intended bindings.
 * @evidence contracts/e2e.md#shared-execution One launcher emit and one Node child serve all five modules; no further compiler start is made.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The scenario directory is its own sibling in the workspace with its own manifest, so no configuration of another scenario reaches it, and Node reads only files this emit wrote.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former emitted-text rewrite and preservation checks and the Node-executed result array.
 */
export function case_paths_rewrites_only_unshadowed_require(
  workspace: UtilityWorkspace.IWorkspace,
): void {
  const scenario = "paths/require-shadow";
  const emit = UtilityWorkspace.emit(workspace, scenario);
  assert.equal(emit.status, 0, emit.stderr);
  for (const file of ["loader.js", "unbound.js"])
    assert.match(
      UtilityWorkspace.read(workspace, scenario, "dist/" + file),
      /require\("\.\/lib\/message\.cjs"\)/,
      file,
    );
  for (const file of ["parameter.js", "local.js", "imported.js"])
    assert.match(
      UtilityWorkspace.read(workspace, scenario, "dist/" + file),
      /@lib\/message/,
      file,
    );
  const cwd = UtilityWorkspace.project(workspace, scenario);
  const run = TestProject.runNode(path.join(cwd, "runner.mjs"), { cwd });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(
    run.stdout.trim(),
    '["@lib/message","local:@lib/message","imported:@lib/message","ok","ok"]',
  );
}
