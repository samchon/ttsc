import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { CompilerArgumentsInspection } from "../../../../../packages/ttsc/src/compiler/internal/CompilerArgumentsInspection";
import { CompilerProjectSelection } from "../../../../../packages/ttsc/src/compiler/internal/project/CompilerProjectSelection";
import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { parseTtscBuildArgs } from "../../../../../packages/ttsc/src/launcher/internal/parseTtscBuildArgs";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies one project authority while retaining the compiler argument base.
 *
 * 1. Create two configurations and response frames anchored in the first.
 * 2. Select through actual launcher parsing and the shared source operation.
 * 3. Assert ordered selection, original frame transport and fresh observations.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual parseTtscBuildArgs and CompilerProjectSelection.read resolve real configuration/response inputs; assertions inspect selected config/root, compiler cwd, forwarded frames and observation changes.
 * @evidence contracts/testing.md#independent-expectations Authored A/B configurations and literal argument orders independently require the last project occurrence to select that configuration while response paths retain A as their original base.
 * @evidence contracts/testing.md#distinguishing-cases Visible aliases before and after a response, repeated and nested frames, explicit resolvedProject authority, scalar @ operands, response deletion/repair and changed bytes separate selection from option transport and response lifetime.
 * @evidence contracts/testing.md#execution-ownership The source operations read one tracked temporary filesystem fixture in this unit process. No native compiler, installed host, watcher or child process runs; TestProject owns exit cleanup.
 */
export function test_compiler_project_selection_preserves_argument_order_and_cwd(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-compiler-project-selection-"),
  );
  const a = path.join(root, "A");
  const b = path.join(root, "B");
  for (const directory of [a, b]) {
    fs.mkdirSync(directory);
    fs.writeFileSync(
      path.join(directory, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { outDir: "products" }, files: [] }),
    );
  }
  const configA = path.join(a, "tsconfig.json");
  const configB = path.join(b, "tsconfig.json");
  const response = path.join(a, "selector.rsp");
  const nested = path.join(a, "nested.rsp");
  fs.writeFileSync(response, "--project ../B/tsconfig.json --outDir relative");
  fs.writeFileSync(nested, "@selector.rsp");
  const select = (argv: readonly string[]) =>
    CompilerProjectSelection.read({ ...parseTtscBuildArgs(argv), cwd: root });
  for (const alias of ["-p", "--project", "--tsconfig", "--PROJECT"]) {
    const selected = select([alias, configA, "@selector.rsp"]);
    assert.equal(selected.project.path, configB);
    assert.equal(selected.project.root, b);
    assert.equal(selected.compilerArgsCwd, a);
    assert.ok(selected.args.includes("@selector.rsp"));
    assert.ok(selected.observations.has(response));
    const later = select(["@selector.rsp", alias, configA]);
    assert.equal(later.project.path, configA);
    assert.equal(later.compilerArgsCwd, a);
  }
  const repeated = select(["-p", configA, "@nested.rsp", "@selector.rsp"]);
  assert.equal(repeated.project.path, configB);
  assert.deepEqual([...repeated.observations.keys()], [nested, response]);
  const pinned = CompilerProjectSelection.read({
    cwd: root,
    passthrough: ["@selector.rsp"],
    resolvedProject: readProjectConfig({ tsconfig: configA }),
  });
  assert.equal(pinned.project.path, configA);
  assert.equal(pinned.compilerArgsCwd, a);
  const scalar = select(["-p", configA, "--outDir", "@selector.rsp"]);
  assert.equal(scalar.project.path, configA);
  assert.equal(scalar.observations.size, 0);
  fs.writeFileSync(response, "--project tsconfig.json");
  const repaired = select(["-p", configA, "@selector.rsp"]);
  assert.equal(repaired.project.path, configA);
  assert.notEqual(
    repaired.observations.get(response),
    repeated.observations.get(response),
  );
  assert.equal(
    repaired.observations.get(response),
    CompilerArgumentsInspection.observeInputFile(response),
  );
  fs.unlinkSync(response);
  const missing = select(["-p", configA, "@selector.rsp"]);
  assert.match(String(missing.inspectionError), /ENOENT/);
  assert.deepEqual(missing.projectGuard, []);
  fs.writeFileSync(response, "--project ../B/tsconfig.json");
  assert.equal(select(["-p", configA, "@selector.rsp"]).project.path, configB);
  for (const reset of ["null", '""']) {
    fs.writeFileSync(response, "--project " + reset);
    const resetSelection = CompilerProjectSelection.read({
      cwd: root, tsconfig: configB, compilerArgsCwd: a,
      passthrough: ["@selector.rsp"],
    });
    assert.equal(resetSelection.project.path, configA);
    assert.equal(resetSelection.compilerArgsCwd, a);
  }
  for (const text of ["--project", "--outDir", "--not-a-native-option"]) {
    fs.writeFileSync(response, text);
    const unavailable = select(["-p", configA, "@selector.rsp"]);
    assert.notEqual(unavailable.inspectionError, undefined);
    assert.deepEqual(unavailable.projectGuard, []);
    assert.equal(unavailable.project.path, configA);
    assert.deepEqual(unavailable.passthrough, ["@selector.rsp"]);
  }
  fs.writeFileSync(path.join(a, "broken.json"), "{ invalid JSON");
  fs.writeFileSync(response, "--project ../B/tsconfig.json");
  assert.equal(select(["-p", path.join(a, "broken.json"), "@selector.rsp"]).project.path, configB);
  const supersededMissing = CompilerProjectSelection.read({
    cwd: a, tsconfig: "missing.json", passthrough: ["@selector.rsp"],
  });
  assert.equal(supersededMissing.project.path, configB);
  for (const locator of [configA, path.join(a, "missing.json")]) {
    const watch = CompilerProjectSelection.read({
      ...parseTtscBuildArgs(["--watch", "-p", locator, "@selector.rsp"]),
      cwd: a,
    });
    assert.equal(watch.project.root, b);
  }
  assert.throws(
    () => CompilerProjectSelection.read({ cwd: a, tsconfig: "missing.json" }),
    /tsconfig not found/,
  );
  const explicitRoot = CompilerProjectSelection.read({
    cwd: a, tsconfig: configA, projectRoot: root,
    compilerArgsCwd: a, passthrough: ["@selector.rsp"],
  });
  assert.equal(explicitRoot.project.path, configB);
  assert.equal(explicitRoot.project.root, root);
  const stale = select(["-p", configA, "@selector.rsp"]);
  fs.writeFileSync(response, "--project tsconfig.json");
  assert.throws(() => CompilerProjectSelection.assertCurrent(stale), /changed after project selection/);
}
