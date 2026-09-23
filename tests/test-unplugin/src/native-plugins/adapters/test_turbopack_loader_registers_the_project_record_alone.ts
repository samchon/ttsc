import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { readProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { emitDependenciesPlugins } from "../../internal/adapter-turbopack/emitDependenciesPlugins";
import { projectRecordOf } from "../../internal/adapter-turbopack/projectRecordOf";
import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";

/**
 * Verifies the Turbopack loader registers the project's record as a module's
 * one dependency beside the module itself, and that the record names every
 * input of the generation, plugin-reported dependencies included.
 *
 * A generation compiles the whole project, so a module's output is a function
 * of the project's state and of nothing finer. The loader used to hand
 * Turbopack every compiler input through its file and directory channels, and
 * each channel's flaws became the adapter's: a directory read as a file failed
 * the module and crossed the worker pool's results, an input outside the
 * project root failed the module outright, a change before Turbopack's baseline
 * never re-ran it. The record is one file inside the project, which Turbopack
 * watches and snapshots like any other, and the adapter moves it when the state
 * does.
 *
 * 1. Run the loader on the entry of a project whose plugin reports no
 *    dependencies, and assert the record is the one file dependency, no
 *    directory is registered, and the record lies in the project's own tool
 *    directory.
 * 2. Run it with a plugin reporting a relative entry, an absolute entry, a
 *    duplicate, and the module itself, and assert the record is still the one
 *    dependency and names the two reported paths, absolutized, once each.
 */
export async function test_turbopack_loader_registers_the_project_record_alone(): Promise<void> {
  const root = TestUnpluginProject.createProject();
  const plain = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
  });
  TestUnpluginProject.assertTransformedToPlugin(plain.content);
  assert.deepEqual(plain.dependencies, [projectRecordOf(root)]);
  assert.deepEqual(plain.contextDependencies, []);
  assert.match(
    path.dirname(path.dirname(projectRecordOf(root))),
    /[\\/]\.ttsc$/,
    "the record lives in the project's own tool directory",
  );

  const reporting = TestUnpluginProject.createProject({ plugins: [] });
  const absolute = path.join(reporting, "types", "model.d.ts");
  const reported = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(reporting),
    source: TestUnpluginProject.mainSource(reporting),
    options: {
      plugins: emitDependenciesPlugins([
        "src/types.d.ts",
        absolute,
        "src/types.d.ts",
        "src/main.ts",
      ]),
    },
  });
  TestUnpluginProject.assertTransformedToPlugin(reported.content);
  assert.deepEqual(reported.dependencies, [projectRecordOf(reporting)]);
  const record = readProjectRecordFile(projectRecordOf(reporting));
  assert.ok(record !== undefined, "the record is written before the hand-over");
  for (const input of [path.join(reporting, "src", "types.d.ts"), absolute]) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(record.inputs, input),
      `the record names ${input}`,
    );
  }
  assert.equal(record.tsconfig, path.join(reporting, "tsconfig.json"));
  assert.equal(record.root, reporting);
}
