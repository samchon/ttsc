import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { CompilerTarget } from "../../../../../packages/ttsc/src/plugin/internal/source/CompilerTarget";
import { NativeSourcePackages } from "../../../../../packages/ttsc/src/plugin/internal/source/NativeSourcePackages";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { SourceBuildCacheLayout } from "../../../../../packages/ttsc/src/plugin/internal/source/SourceBuildCacheLayout";
import { SourcePluginAdmission } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginAdmission";
import { SourcePluginWorkspace } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginWorkspace";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies Go package selection records and recalls answers when
 * `TTSC_TSGO_SOURCE` declares a compiler source, and re-observes when that
 * source changes.
 *
 * Package selection records an answer only when the overlay digests computed
 * after Go ran match the overlay digests folded into the selection identity
 * (samchon/ttsc#1877). Both must include the declared compiler source, or
 * recording would stop or never recall. Rewriting only the recorded package
 * name proves a later selection was answered from the record rather than by
 * running Go again.
 *
 * 1. Select a plugin module with `TTSC_TSGO_SOURCE` set and assert one selection
 *    record is written.
 * 2. Corrupt the recorded package name and select again through a reopened store,
 *    both standalone and with a load's `readings.overlays`; the corrupted name
 *    proves Go did not run and both overlay readers agree.
 * 3. Edit a file inside the declared compiler source; the next selection observes
 *    Go again and records a new answer.
 * 4. Repeat without `TTSC_TSGO_SOURCE` as a control; it records a separate
 *    selection and recalls it after corruption.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls NativeSourcePackages.ownPackages with a real record store and the selected Go toolchain, asserting returned package records and on-disk selection answer files.
 * @evidence contracts/testing.md#independent-expectations The authored package main, the Go module path github.com/microsoft/typescript-go and the literal corrupted names are independent oracles; neither is read back from the functions under test.
 * @evidence contracts/testing.md#distinguishing-cases Declared compiler source recorded and recalled (standalone and with load-provided readings.overlays), edited declared source forcing fresh Go observation, and undeclared control recording and recalling a separate answer.
 * @evidence contracts/testing.md#execution-ownership A unit test that owns a temporary plugin module, declared compiler module and private cache and calls NativeSourcePackages directly; real go list metadata runs, no plugin binary is built and no product host starts.
 */
export function test_package_selection_is_recorded_and_recalled_with_a_declared_compiler_source(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-selection-compiler-source-"),
  );
  const plugin = path.join(root, "plugin");
  const compiler = path.join(root, "compiler");
  const write = (file: string, text: string): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  write(path.join(plugin, "go.mod"), "module example.com/plugin\n\ngo 1.24\n");
  write(path.join(plugin, "main.go"), "package main\n\nfunc main() {}\n");
  write(
    path.join(compiler, "go.mod"),
    "module github.com/microsoft/typescript-go\n\ngo 1.24\n",
  );
  const revision = path.join(compiler, "revision", "revision.go");
  write(revision, 'package revision\n\nconst Name = "declared-one"\n');

  const settle = (directory: string, ageMs: number): void => {
    const past = new Date(Date.now() - ageMs);
    for (const file of listFiles(directory)) fs.utimesSync(file, past, past);
  };
  settle(plugin, 3_600_000);
  settle(compiler, 3_600_000);

  const cache = path.join(root, "cache");
  const answers = path.join(cache, SourceBuildCacheLayout.ANSWER_CACHE_DIRNAME);
  const baseEnv = SidecarEnvironment.merge(process.env);
  // Pin the 7.0 target and prevent ambient GOFLAGS (such as -mod=mod) from
  // conflicting with Go workspace mode or switching the target to 7.1.
  SidecarEnvironment.write(baseEnv, "GOFLAGS", "");
  SidecarEnvironment.write(
    baseEnv,
    SourcePluginAdmission.COMPILER_SOURCE_ENV,
    undefined,
  );
  const declaredEnv = SidecarEnvironment.merge(baseEnv, {
    [SourcePluginAdmission.COMPILER_SOURCE_ENV]: compiler,
  });

  const open = (env: NodeJS.ProcessEnv): PluginContentIdentities.Store => {
    const store = PluginContentIdentities.open({
      projectRoot: root,
      cacheDir: cache,
      env,
    });
    assert.ok(store);
    return store;
  };
  const selections = (): string[] =>
    fs.existsSync(answers)
      ? fs
          .readdirSync(answers)
          .filter((name) => name.endsWith(".json"))
          .map((name) => path.join(answers, name))
          .filter(
            (file) =>
              (JSON.parse(fs.readFileSync(file, "utf8")) as { kind?: unknown })
                .kind === "go-package-selection",
          )
      : [];
  const corruptName = (file: string, name: string): void => {
    const entry = JSON.parse(fs.readFileSync(file, "utf8")) as {
      value: Array<{ Name: string }>;
    };
    entry.value[0]!.Name = name;
    fs.writeFileSync(file, JSON.stringify(entry));
  };
  const select = (
    env: NodeJS.ProcessEnv,
    readings?: NativeSourcePackages.SelectionReadings,
  ): NativeSourcePackages.Package =>
    NativeSourcePackages.ownPackages(
      [{ source: plugin, label: "plugin" }],
      env,
      undefined,
      open(env),
      readings,
    )[0]!;

  // 1. First selection with TTSC_TSGO_SOURCE runs Go and records an answer.
  const first = select(declaredEnv);
  assert.equal(first.Name, "main");
  assert.deepEqual(first.GoFiles, ["main.go"]);
  const afterFirst = selections();
  assert.equal(
    afterFirst.length,
    1,
    "first selection with TTSC_TSGO_SOURCE records one selection answer",
  );

  // 2. Second selection with unchanged declared source recalls the record.
  const firstRecord = afterFirst[0]!;
  corruptName(firstRecord, "recorded");
  assert.equal(
    select(declaredEnv).Name,
    "recorded",
    "unchanged declared compiler source recalls the recorded selection",
  );
  const loadOverlays = SourcePluginWorkspace.withCompilerSource(
    SourcePluginWorkspace.findTtscOverlayDirs(
      CompilerTarget.ofEnv(declaredEnv),
    ),
    declaredEnv,
  );
  assert.equal(
    select(declaredEnv, { overlays: loadOverlays }).Name,
    "recorded",
    "load readings.overlays matches selectionOverlayDirs and recalls the same record",
  );

  // 3. Editing a file in the declared compiler source observes Go again.
  write(revision, 'package revision\n\nconst Name = "declared-two-edited"\n');
  settle(compiler, 1_800_000);
  const afterEdit = select(declaredEnv);
  assert.equal(
    afterEdit.Name,
    "main",
    "editing the declared compiler source invalidates the record and runs Go",
  );
  assert.deepEqual(afterEdit.GoFiles, ["main.go"]);
  const afterSecond = selections();
  assert.equal(
    afterSecond.length,
    2,
    "edited declared compiler source records a second selection answer",
  );

  // 4. Control without TTSC_TSGO_SOURCE still records and recalls separately.
  const control = select(baseEnv);
  assert.equal(control.Name, "main");
  assert.deepEqual(control.GoFiles, ["main.go"]);
  const afterControl = selections();
  assert.equal(
    afterControl.length,
    3,
    "control selection without TTSC_TSGO_SOURCE records its own answer",
  );
  const known = new Set(afterSecond);
  const controlRecord = afterControl.find((file) => !known.has(file));
  assert.ok(controlRecord !== undefined);
  corruptName(controlRecord, "recorded-control");
  assert.equal(
    select(baseEnv).Name,
    "recorded-control",
    "unchanged control selection recalls its recorded answer",
  );
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(location) : [location];
  });
}
