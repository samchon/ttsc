import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GoEnvironmentReading } from "../../../../../packages/ttsc/src/plugin/internal/source/GoEnvironmentReading";
import { GoToolResolution } from "../../../../../packages/ttsc/src/plugin/internal/source/GoToolResolution";
import { GoWorkspaceEnvironment } from "../../../../../packages/ttsc/src/plugin/internal/source/GoWorkspaceEnvironment";
import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";
import { SourcePluginWorkspace } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginWorkspace";
import { resolveGoCompiler } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveGoCompiler";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that workspace preparation exposes the actual external Go settings.
 *
 * 1. Fail native go work use through the scratch-relative Go settings file.
 * 2. Remove the scratch directory and then edit the external file.
 * 3. Verify the observed present and missing settings survive scratch cleanup.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises native workspace preparation and the projection shared by watch recovery and successful workspace evidence.
 * @evidence contracts/testing.md#independent-expectations Written settings force a native toolchain error. The fixture separately observes the surviving settings path and its current state before and after repair.
 * @evidence contracts/testing.md#distinguishing-cases Existing external settings, missing external settings, owned scratch files and POSIX link-parent suffixes must project differently.
 * @evidence contracts/testing.md#execution-ownership Uses a private workspace and child environment; removes only private fixtures after the synchronous native command completes.
 */
export function test_generated_go_workspace_retains_external_settings(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-workspace-goenv-"),
  );
  const scratch = path.join(root, "scratch");
  const settingsName = `${path.basename(root)}.env`;
  const settings = path.join(root, settingsName);
  const telemetry = path.join(root, "telemetry");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GOENV: `../${settingsName}`,
    TEST_TELEMETRY_DIR: telemetry,
  };
  delete env.GOTOOLCHAIN;
  try {
    fs.mkdirSync(telemetry);
    fs.writeFileSync(path.join(telemetry, "mode"), "off\n");
    fs.mkdirSync(scratch);
    fs.writeFileSync(
      path.join(scratch, "go.mod"),
      "module example.com/workspace\n",
    );
    fs.writeFileSync(settings, "GOTOOLCHAIN=ttsc-invalid-workspace-test\n");
    const go = GoToolResolution.resolveGoToolForBuild(
      resolveGoCompiler(env).binary,
      env,
      scratch,
    );
    const observed: PluginBuildEnvironmentWitness.Record = new Map();
    assert.throws(
      () =>
        GoEnvironmentReading.withRecoveryObservations(
          (proof) =>
            PluginBuildEnvironmentWitness.retainForRecovery(observed, proof),
          () =>
            SourcePluginWorkspace.writeGoWork(
              scratch,
              [],
              go,
              "workspace-settings",
              env,
              undefined,
              undefined,
              root,
            ),
        ),
      /setting the Go workspace version.*failed/i,
    );
    assert.ok(observed.has(settings));
    const failureProof = new Map([[settings, observed.get(settings)!]]);
    const defaultProof =
      process.platform === "win32"
        ? verifyWindowsDefaultSettings(root, scratch, go, env)
        : undefined;

    const read = (relative: string) => {
      const witness: PluginBuildEnvironmentWitness.Record = new Map();
      PluginBuildEnvironmentWitness.add(
        witness,
        GoToolResolution.workingPath(scratch, relative),
      );
      return GoWorkspaceEnvironment.externalWitness(scratch, witness, {
        GOENV: relative,
      });
    };
    const absent = path.join(root, "absent.env");
    const missingProof = read("../absent.env");
    assert.deepEqual([...missingProof.keys()], [absent]);
    fs.writeFileSync(path.join(scratch, "owned.env"), "GOTOOLCHAIN=local\n");
    assert.equal(read("owned.env").size, 0);

    const moving = path.join(root, "moving.env");
    fs.writeFileSync(moving, "GOTOOLCHAIN=local\n");
    const beforeMove: PluginBuildEnvironmentWitness.Record = new Map();
    PluginBuildEnvironmentWitness.add(
      beforeMove,
      GoToolResolution.workingPath(scratch, "../moving.env"),
    );
    fs.writeFileSync(moving, "GOTOOLCHAIN=auto\n# moved\n");
    const movingProof = GoWorkspaceEnvironment.externalWitness(
      scratch,
      beforeMove,
      { GOENV: "../moving.env" },
    );
    assert.deepEqual([...movingProof.keys()], [moving]);
    assert.equal(PluginBuildEnvironmentWitness.holds(movingProof), false);

    let linkedProof: PluginBuildEnvironmentWitness.Record | undefined;
    const link = path.join(root, "link");
    const next = path.join(root, "next", "nested");
    if (process.platform !== "win32") {
      const native = path.join(root, "native", "nested");
      fs.mkdirSync(native, { recursive: true });
      fs.mkdirSync(next, { recursive: true });
      fs.writeFileSync(path.join(root, "native", "linked.env"), "first");
      fs.writeFileSync(path.join(root, "next", "linked.env"), "second");
      fs.symlinkSync(native, link);
      linkedProof = read("../link/../linked.env");
      assert.deepEqual([...linkedProof.keys()], [`${link}/../linked.env`]);
    }

    fs.rmSync(scratch, { recursive: true });
    assert.equal(PluginBuildEnvironmentWitness.holds(failureProof), true);
    assert.equal(PluginBuildEnvironmentWitness.holds(missingProof), true);
    if (defaultProof !== undefined) {
      assert.equal(PluginBuildEnvironmentWitness.holds(defaultProof), true);
      const [file] = defaultProof.keys();
      fs.writeFileSync(file!, "GOTOOLCHAIN=local\n");
      assert.equal(PluginBuildEnvironmentWitness.holds(defaultProof), false);
    }
    fs.writeFileSync(settings, "GOTOOLCHAIN=local\n");
    fs.writeFileSync(absent, "GOTOOLCHAIN=local\n");
    assert.equal(PluginBuildEnvironmentWitness.holds(failureProof), false);
    assert.equal(PluginBuildEnvironmentWitness.holds(missingProof), false);
    if (linkedProof !== undefined) {
      assert.equal(PluginBuildEnvironmentWitness.holds(linkedProof), true);
      fs.unlinkSync(link);
      fs.symlinkSync(next, link);
      assert.equal(PluginBuildEnvironmentWitness.holds(linkedProof), false);
    }
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}

function verifyWindowsDefaultSettings(
  root: string,
  scratch: string,
  go: string,
  base: NodeJS.ProcessEnv,
): PluginBuildEnvironmentWitness.Record {
  const env: NodeJS.ProcessEnv = { ...base, APPDATA: "." };
  delete env.GOENV;
  const local = { ...env, GOTOOLCHAIN: "local" };
  const witness: PluginBuildEnvironmentWitness.Record = new Map();
  const first = path.join(root, "go", "env");
  const second = path.join(scratch, "go", "env");
  for (const file of [first, second])
    fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(first, "GOFLAGS=-trimpath\n");
  fs.writeFileSync(second, "GOFLAGS=-buildvcs=false\n");
  const read = (cwd: string) =>
    GoEnvironmentReading.read(
      go,
      cwd,
      local,
      ["GOFLAGS"],
      witness,
      undefined,
      root,
    )?.values;
  assert.equal(read(root)?.GOFLAGS, "-trimpath");
  assert.equal(read(scratch)?.GOFLAGS, "-buildvcs=false");
  assert.equal(GoWorkspaceEnvironment.canUseOrigin(local, witness), false);
  assert.equal(
    GoWorkspaceEnvironment.externalWitness(scratch, witness, local).has(second),
    false,
  );

  const profile = `${path.basename(root)}-profile`;
  const setting = path.join(root, profile, "go", "env");
  fs.mkdirSync(path.dirname(setting), { recursive: true });
  fs.writeFileSync(setting, "GOTOOLCHAIN=ttsc-invalid-default-settings\n");
  const captures: PluginBuildEnvironmentWitness.Record = new Map();
  assert.throws(
    () =>
      GoEnvironmentReading.withRecoveryObservations(
        (proof) =>
          PluginBuildEnvironmentWitness.retainForRecovery(captures, proof),
        () =>
          SourcePluginWorkspace.writeGoWork(
            scratch,
            [],
            go,
            "workspace-default-settings",
            { ...env, APPDATA: `../${profile}` },
            undefined,
            undefined,
            root,
          ),
      ),
    /setting the Go workspace version.*failed/i,
  );
  assert.ok(captures.has(setting));
  return new Map([[setting, captures.get(setting)!]]);
}
