import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runPooledWorker } from "../../internal/pooled-session/runPooledWorker";

/**
 * Verifies a worker does not adopt another worker's compile of external inputs
 * that have changed since, and that its own compile replaces the publication
 * for the rest of the pool (samchon/ttsc#1390).
 *
 * A publication is named by the project walk's state, but a plugin can read a
 * file outside the project and report it only as a dependency, with no
 * compile-time proof in the envelope. After that file changes, the walk's state
 * still matches, so an adopter must compare the file with the state the
 * publisher recorded, compile for itself on a mismatch rather than adopt the
 * same publication on its retry, and publish its own compile in its place.
 *
 * 1. Compile in one worker a project whose plugin reads and reports a file outside
 *    the project.
 * 2. Change that file and transform in a second worker, and assert it compiled the
 *    new content.
 * 3. Transform in a third, and assert it adopted the second worker's compile.
 */
export async function test_transformttsc_pooled_workers_reject_a_compile_of_other_external_inputs(): Promise<void> {
  const external = path.join(
    TestProject.tmpdir("ttsc-unplugin-pooled-external-"),
    "helper.ts",
  );
  fs.writeFileSync(external, "first\n", "utf8");
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-pooled-external-log-"),
    "compiles.bin",
  );
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const relative = path.relative(root, external);
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.plugins = [
    {
      transform: "./plugin.cjs",
      name: "reader",
      operation: "read-configured-helper",
      path: relative,
    },
    {
      transform: "./plugin.cjs",
      name: "reporter",
      operation: "emit-dependencies",
      dependencies: [relative.split(path.sep).join("/")],
    },
    {
      transform: "./plugin.cjs",
      name: "runs",
      operation: "count-runs",
      runLog,
    },
  ];
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
  const session = TestProject.tmpdir("ttsc-unplugin-pooled-external-session-");
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const transform = async () => {
    const result = await runPooledWorker({
      file: TestUnpluginProject.mainFile(root),
      session,
    });
    assert.equal(result.error, undefined, result.error);
    return result.code ?? "";
  };

  // A fresh worker learns the reported file from its first compile and
  // publishes the second, which witnessed it (samchon/ttsc#1541).
  assert.match(await transform(), /PLUGIN:FIRST/);
  assert.equal(compiles(), 2);

  // The refuted publication names the file, so the worker's own compile
  // witnesses it at once.
  fs.writeFileSync(external, "second\n", "utf8");
  assert.match(await transform(), /PLUGIN:SECOND/);
  assert.equal(compiles(), 3, "a compile of the old file is not adopted");

  assert.match(await transform(), /PLUGIN:SECOND/);
  assert.equal(compiles(), 3, "the replacement is adopted");
}
