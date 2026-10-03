import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { filterCandidatesByPhysicalRoots } from "../../../../../packages/vscode/src/clientRootPlanning";
import type { ResolutionCandidate } from "../../../../../packages/vscode/src/ResolutionCandidate";
import { createServerRootPathIdentityContext } from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies one physical survivor is returned once in original input priority.
 *
 * A repeated object reference and distinct candidate objects naming one native
 * directory alias must both collapse. Disjoint roots retain their input order,
 * while an ancestor loses to its deeper descendant regardless of that order.
 *
 * 1. Create an ancestor, descendant, sibling and actual directory alias.
 * 2. Compare repeated references and distinct alias candidates with literal survivors.
 * 3. Contrast disjoint-root order with ancestor/descendant selection.
 *
 * @evidence contracts/testing.md#behavioral-verification Directly imports filterCandidatesByPhysicalRoots, supplying the actual shared identity context; observes exact result multiplicity, reference identity, original ordering and unmodified inputs.
 * @evidence contracts/testing.md#independent-expectations Authored directory topology and independently equal native realpaths establish the alias premise. Literal arrays select the first alias and the deeper candidate; expectations are not calculated by the planner.
 * @evidence contracts/testing.md#distinguishing-cases Repeating the same DTO distinguishes a final membership filter from consuming a survivor once. Distinct native aliases contrast with disjoint roots in deliberately reversed depth order, and both ancestor input orders require the deeper root.
 * @evidence contracts/testing.md#execution-ownership The matching ttscserver feature export runs the maintained root planner directly in process. The fixture is real filesystem input with a Windows junction or POSIX directory symlink; no VS Code client, installed consumer, child process or synthetic identity operation is used.
 */
export function test_vscode_root_planning_retains_each_physical_survivor_once(): void {
  const root = TestProject.tmpdir("vscode-root-survivors-");
  const ancestor = path.join(root, "parent");
  const descendant = path.join(ancestor, "nested");
  const sibling = path.join(root, "sibling");
  const alias = path.join(root, "alias");
  fs.mkdirSync(descendant, { recursive: true });
  fs.mkdirSync(sibling);
  fs.symlinkSync(descendant, alias, process.platform === "win32" ? "junction" : "dir");
  assert.equal(fs.realpathSync.native(alias), fs.realpathSync.native(descendant));

  const first: ResolutionCandidate = { cwd: descendant, resolveFrom: descendant };
  const second: ResolutionCandidate = { cwd: alias, resolveFrom: alias };
  const parent: ResolutionCandidate = { cwd: ancestor, resolveFrom: ancestor };
  const other: ResolutionCandidate = { cwd: sibling, resolveFrom: sibling };
  const select = (candidates: readonly ResolutionCandidate[]) =>
    filterCandidatesByPhysicalRoots(candidates, createServerRootPathIdentityContext(), process.platform);
  const failures: Error[] = [];
  const check = (name: string, run: () => void): void => {
    try { run(); }
    catch (cause) { failures.push(new Error(name, { cause })); }
  };
  check("repeated reference", () => {
    const input = [first, first];
    const result = select(input);
    assert.deepEqual(result, [first]);
    assert.equal(result[0], first);
    assert.deepEqual(input, [first, first]);
  });
  check("distinct physical aliases", () => {
    const input = [first, second];
    const result = select(input);
    assert.deepEqual(result, [first]);
    assert.equal(result[0], first);
    assert.deepEqual(input, [first, second]);
    assert.equal(select([second, first])[0], second);
    assert.deepEqual(select([second, first]), [second]);
  });
  check("disjoint roots preserve priority", () => {
    assert.deepEqual(select([other, first]), [other, first]);
    assert.deepEqual(select([first, other]), [first, other]);
  });
  check("descendant suppresses ancestor", () => {
    assert.deepEqual(select([parent, first]), [first]);
    assert.deepEqual(select([first, parent]), [first]);
  });
  if (failures.length) throw new AggregateError(failures, "Physical root survivor distinctions failed");
}
