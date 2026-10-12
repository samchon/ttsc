import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GoToolResolution } from "../../../../../packages/ttsc/src/plugin/internal/source/GoToolResolution";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { SourcePluginWorkspace } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginWorkspace";
import { pluginModuleReplaceDirectories } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginModuleReplaceDirectories";
import { resolveGoCompiler } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveGoCompiler";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the reader a load's watch-input projection registers first carries
 * the load's record store, so the load's later reads reuse recorded go.mod
 * syntax (samchon/ttsc#1739).
 *
 * A load that reports watch inputs reads each plugin module's `replace`
 * directives before any build, through the shared reader map. That reader was
 * registered without the store, and the map hands the first reader to every
 * later request of the load, so no record was ever read or written and every
 * load ran `go mod edit -json` again.
 *
 * 1. Project a module's replacement directories through a fresh reader map and
 *    store, and assert one recorded parse.
 * 2. Corrupt the recorded module path, project again through a new map and a
 *    reopened store, and read through the map: the corrupted path proves the
 *    registered reader answered from the record instead of running Go.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Go parses a real manifest through the actual projection and reader; the record files on disk and the returned module path are asserted.
 * @evidence contracts/testing.md#independent-expectations The authored replace directive fixes the projected directory, and the corrupted literal is the oracle for a recorded answer.
 * @evidence contracts/testing.md#distinguishing-cases A first load that must record and a second load that must reuse are separate rows.
 * @evidence contracts/testing.md#execution-ownership The named unit owns its temporary modules and private cache root below the checkout's ignored `.cache`, on the device of the Go toolchain; `go env` and `go mod edit` run, and no plugin is built.
 */
export function test_go_mod_reader_registered_by_watch_projection_keeps_the_record_store(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir(
      "ttsc-go-mod-projection-",
      path.join(TestProject.WORKSPACE_ROOT, ".cache"),
    ),
  );
  const module = path.join(root, "plugin");
  const dependency = path.join(root, "dep");
  fs.mkdirSync(module, { recursive: true });
  fs.mkdirSync(dependency, { recursive: true });
  fs.writeFileSync(
    path.join(module, "go.mod"),
    "module example.com/plugin\n\ngo 1.24\n\nreplace example.com/dep => ../dep\n",
  );
  fs.writeFileSync(
    path.join(dependency, "go.mod"),
    "module example.com/dep\n\ngo 1.24\n",
  );
  const cache = path.join(root, "cache");
  const answers = path.join(cache, "answers");
  const env: NodeJS.ProcessEnv = { ...process.env };
  const open = (): PluginContentIdentities.Store => {
    const store = PluginContentIdentities.open({
      projectRoot: root,
      cacheDir: cache,
      env,
    });
    assert.ok(store);
    return store;
  };
  const goBinary = GoToolResolution.resolveGoToolForBuild(
    resolveGoCompiler(env).binary,
    env,
    module,
  );
  const records = (): string[] =>
    fs.existsSync(answers)
      ? fs
          .readdirSync(answers)
          .filter((name) => name.endsWith(".json"))
          .map((name) => path.join(answers, name))
          .filter((file) =>
            fs.readFileSync(file, "utf8").includes('"directives"'),
          )
      : [];
  assert.ok(
    PluginContentIdentities.separable(
      open().references,
      fs.statSync(goBinary, { bigint: true }),
    ),
    "premise: the suite's Go launcher lies on a device the store references",
  );

  const first = pluginModuleReplaceDirectories(
    module,
    env,
    goBinary,
    undefined,
    new Map(),
    open(),
  );
  assert.deepEqual(
    first.map((replacement) => replacement.directory),
    [dependency],
  );
  assert.equal(records().length, 1, "the projection's reader records");

  const corrupted = "corrupted.example/recorded";
  for (const file of records()) {
    const entry = JSON.parse(fs.readFileSync(file, "utf8")) as {
      value: { modulePath: string };
    };
    entry.value.modulePath = corrupted;
    fs.writeFileSync(file, JSON.stringify(entry));
  }
  const readers = new Map<string, SourcePluginWorkspace.GoModReader>();
  const store = open();
  pluginModuleReplaceDirectories(
    module,
    env,
    goBinary,
    undefined,
    readers,
    store,
  );
  assert.equal(
    SourcePluginWorkspace.createGoModReader(
      goBinary,
      "plugin",
      env,
      readers,
      store,
    ).read(module).modulePath,
    corrupted,
    "the load's later read is answered from the record",
  );
}
