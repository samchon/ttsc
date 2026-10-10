import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { OwnedSynchronousProcess } from "../../../../../packages/ttsc/src/internal/OwnedSynchronousProcess";
import { GoToolResolution } from "../../../../../packages/ttsc/src/plugin/internal/source/GoToolResolution";
import { SourcePluginWorkspace } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginWorkspace";
import { pluginModuleReplaceDirectories } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginModuleReplaceDirectories";
import { resolveGoCompiler } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveGoCompiler";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies copied Go manifests share parsing without hiding current edits.
 *
 * Go owns grammar; equivalent bytes inside one selected-tool reader can share
 * its parsed syntax while separate loads and edited manifests cannot.
 *
 * 1. Copy one maintained native fixture into two independent source directories.
 * 2. Observe equal bytes through one reader, then change and remove a manifest.
 * 3. Refuse invalid syntax/environment, repair them, and distinguish a new scope.
 * 4. Feed unavailable environment transport through the existing launch owner and
 *    require each successful manifest query to execute a fresh parse.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual selected Go parses maintained manifest bytes; early watch projection acquires the same selected-tool/load reader used by later source queries, equal copies return the same parsed record, edited bytes change module identity, missing manifests return no module, malformed syntax throws and restored bytes recover. An actual GOENV-file edit makes native Go reject an invalid toolchain selection even with unchanged variables; the warm reader must refuse, then reacquire equivalent syntax after repair. A separate reader returns equivalent but independently acquired data. Authored null/array/scalar/malformed/incomplete environment replies use the existing owned launch adapter; each leaves syntax sharing unavailable while two actual reader calls independently execute their manifest parse.
 * @evidence contracts/testing.md#independent-expectations The maintained fixture declares example.com/plugin; an authored module-name edit declares example.com/changed. Identity equality contrasts reuse with fresh acquisition, and native removal/invalid syntax independently require absence/refusal.
 * @evidence contracts/testing.md#distinguishing-cases Early watch selection with a literal remote replacement, same bytes at different scratch addresses, changed bytes at the same address, missing/repaired manifest, invalid grammar, actual native environment-file invalidation/repair different reader contexts and unavailable environment transports distinguish content reuse from pathname or global positive caching.
 * @evidence contracts/testing.md#execution-ownership Discovered ttsc source unit copies the existing native fixture and invokes real selected Go mod edit through the actual reader. Supplemental transport cases use the existing OwnedSynchronousProcess launch boundary with real capture files and authored replies, counting parse requests without launching native commands; they do not certify native Go grammar or process retirement. No compiler/plugin binary is built, no tool method is replaced, and no consumer install or host starts; TestProject owns temporary cleanup.
 */
export function test_go_manifest_reader_shares_bytes_only_in_its_tool_context(): void {
  const root = TestProject.tmpdir("ttsc-manifest-context-");
  const fixture = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages/unplugin/test/fixtures/e2e/createMovingEnvironmentFixture/inputs-1/plugin",
  );
  const first = path.join(root, "first");
  const second = path.join(root, "second");
  TestProject.copyDirectory(fixture, first);
  TestProject.copyDirectory(fixture, second);
  const environmentFile = path.join(root, "go.env");
  fs.writeFileSync(environmentFile, "");
  const env: NodeJS.ProcessEnv = { ...process.env, GOENV: environmentFile };
  delete env.GOTOOLCHAIN;
  const go = GoToolResolution.resolveGoToolForBuild(
    resolveGoCompiler(env).binary,
    env,
    first,
  );
  // A remote versioned replacement invokes Go syntax parsing while yielding no
  // external directory, matching early watch projection before metadata/build.
  for (const directory of [first, second])
    fs.appendFileSync(
      path.join(directory, "go.mod"),
      "\nreplace example.com/remote v1.0.0 => example.com/other v1.0.1\n",
    );
  const readers = new Map<string, SourcePluginWorkspace.GoModReader>();
  assert.deepEqual(
    pluginModuleReplaceDirectories(first, env, go, undefined, readers),
    [],
  );
  const early = readers.get(go);
  assert.ok(early !== undefined);
  const watched = early.read(first);
  const reader = SourcePluginWorkspace.createGoModReader(
    go,
    "manifest-context",
    env,
    readers,
  );
  assert.equal(
    reader,
    early,
    "watch projection and metadata/build acquire one load-owned reader",
  );
  const original = fs.readFileSync(path.join(first, "go.mod"), "utf8");
  const parsed = reader.read(first);
  assert.equal(
    parsed,
    watched,
    "initial watch syntax is shared with later source queries",
  );
  assert.equal(parsed.modulePath, "example.com/plugin");
  assert.equal(
    reader.read(second),
    parsed,
    "identical materialized bytes share one actual Go parse",
  );
  const manifest = path.join(second, "go.mod");
  fs.writeFileSync(
    manifest,
    original.replace("example.com/plugin", "example.com/changed"),
  );
  const changed = reader.read(second);
  assert.notEqual(changed, parsed);
  assert.equal(changed.modulePath, "example.com/changed");
  fs.unlinkSync(manifest);
  assert.equal(reader.read(second).modulePath, null);
  fs.writeFileSync(manifest, "this is not a Go module directive\n");
  assert.throws(() => reader.read(second), /reading go.mod/);
  fs.writeFileSync(manifest, original);
  assert.equal(reader.read(second), parsed);
  // Fixed variable strings do not freeze the actual GOENV file. A fresh Go
  // command rejects this authored invalid selection, so a warm reader must too.
  fs.writeFileSync(environmentFile, "GOTOOLCHAIN=invalid-native-selection\n");
  assert.throws(() => reader.read(first), /invalid GOTOOLCHAIN/);
  fs.writeFileSync(environmentFile, "");
  const repairedEnvironment = reader.read(first);
  assert.notEqual(
    repairedEnvironment,
    parsed,
    "environment movement discards old syntax authority",
  );
  assert.deepEqual(repairedEnvironment, parsed);
  const separate = SourcePluginWorkspace.createGoModReader(
    go,
    "another-load",
    env,
  ).read(first);
  assert.notEqual(separate, repairedEnvironment);
  assert.notEqual(
    separate,
    parsed,
    "a new tool/load context acquires its own Go observation",
  );
  assert.deepEqual(separate, parsed);
  const failures: unknown[] = [];
  for (const output of ["null", "[]", "42", '"text"', "{broken", "{}"]) {
    try {
      let parses = 0;
      const scope: OwnedSynchronousProcess.Scope = {
        cancel: new SharedArrayBuffer(4),
        retirements: new Set(),
        launch: (_command, args, options) => {
          let stdout: string;
          if (args[0] === "env") stdout = output;
          else {
            assert.deepEqual(args.slice(0, 3), ["mod", "edit", "-json"]);
            parses++;
            stdout = '{"Module":{"Path":"example.com/plugin"}}';
          }
          assert.ok(Array.isArray(options.stdio));
          const stdoutFd = options.stdio[1];
          assert.equal(typeof stdoutFd, "number");
          fs.writeSync(stdoutFd as number, stdout);
          return {
            pid: 0,
            status: 0,
            signal: null,
            output: [null, Buffer.alloc(0), Buffer.alloc(0)],
            stdout: Buffer.alloc(0),
            stderr: Buffer.alloc(0),
          };
        },
      };
      const unavailable = SourcePluginWorkspace.createGoModReader(
        go,
        "unavailable-environment",
        env,
      );
      const firstFresh = OwnedSynchronousProcess.run(scope, () =>
        unavailable.read(first),
      );
      const nextFresh = OwnedSynchronousProcess.run(scope, () =>
        unavailable.read(first),
      );
      assert.equal(firstFresh.modulePath, "example.com/plugin");
      assert.equal(nextFresh.modulePath, "example.com/plugin");
      assert.notEqual(
        nextFresh,
        firstFresh,
        "unavailable environment permits fresh parsing without syntax sharing",
      );
      assert.equal(parses, 2);
    } catch (cause) {
      failures.push(new Error("environment transport " + output, { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "unavailable native environment transports",
    );
}
