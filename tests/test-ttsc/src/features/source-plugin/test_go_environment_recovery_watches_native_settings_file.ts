import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { systemTempOutsideProject } from "../../../../../packages/ttsc/src/internal/systemTempOutsideProject";
import { GoEnvironmentReading } from "../../../../../packages/ttsc/src/plugin/internal/source/GoEnvironmentReading";
import { GoToolResolution } from "../../../../../packages/ttsc/src/plugin/internal/source/GoToolResolution";
import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";
import { SourcePluginWorkspace } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginWorkspace";
import { resolveGoCompiler } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveGoCompiler";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that Go recovery records the file at the native child address.
 *
 * 1. Fail a cold Go query with a broken default user configuration and observe its
 *    file.
 * 2. Repair the settings and query identical relative GOENV spellings from two
 *    children.
 * 3. Verify that go.mod parsing observes GOENV from its neutral native cwd.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs real Go for settings and go.mod syntax, retaining observations through the production recovery scope.
 * @evidence contracts/testing.md#independent-expectations Private files define the bad toolchain and distinct valid GOFLAGS. The test identifies each written path independently of Go's output.
 * @evidence contracts/testing.md#distinguishing-cases The cold unknown default and one relative spelling used from different native working directories test file selection. The manifest reader uses an approved temp cwd independently of the source directory.
 * @evidence contracts/testing.md#execution-ownership Uses private paths and child-local variable objects. Removes only its private files after synchronous calls return.
 */
export function test_go_environment_recovery_watches_native_settings_file(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-go-env-address-"),
  );
  const project = path.join(root, "project");
  const other = path.join(root, "other");
  const profile = path.join(root, "profile");
  const base =
    process.platform === "darwin"
      ? path.join(profile, "Library", "Application Support")
      : profile;
  const defaultFile = path.join(base, "go", "env");
  try {
    fs.mkdirSync(project);
    fs.mkdirSync(other);
    fs.mkdirSync(path.dirname(defaultFile), { recursive: true });
    fs.writeFileSync(
      path.join(project, "go.mod"),
      "module example.com/settings\n",
    );
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      APPDATA: profile,
      HOME: profile,
      XDG_CONFIG_HOME: profile,
    };
    delete env.GOENV;
    delete env.GOTOOLCHAIN;
    delete env.GOFLAGS;
    const tool = GoToolResolution.resolveGoToolForBuild(
      resolveGoCompiler(env).binary,
      env,
      project,
    );
    const observed: PluginBuildEnvironmentWitness.Record = new Map();
    const duringRecovery = <T>(step: () => T): T =>
      GoEnvironmentReading.withRecoveryObservations(
        (proof) =>
          PluginBuildEnvironmentWitness.retainForRecovery(observed, proof),
        step,
      );
    const read = (directory: string, variables: NodeJS.ProcessEnv) =>
      duringRecovery(() =>
        GoEnvironmentReading.read(
          tool,
          directory,
          variables,
          ["GOFLAGS"],
          undefined,
          undefined,
          root,
        ),
      );

    fs.writeFileSync(defaultFile, "GOTOOLCHAIN=ttsc-invalid-toolchain\n");
    assert.equal(read(project, env), undefined);
    assert.equal(observed.has(defaultFile), true);
    fs.writeFileSync(defaultFile, "GOTOOLCHAIN=local\n");
    assert.equal(read(project, env)?.values.GOENV, defaultFile);

    const first = path.join(project, "settings");
    const second = path.join(other, "settings");
    fs.writeFileSync(first, "GOFLAGS=-trimpath\n");
    fs.writeFileSync(second, "GOFLAGS=-buildvcs=false\n");
    const relative = { ...env, GOENV: "settings", GOTOOLCHAIN: "local" };
    assert.equal(read(project, relative)?.values.GOFLAGS, "-trimpath");
    assert.equal(read(other, relative)?.values.GOFLAGS, "-buildvcs=false");
    assert.equal(observed.has(first), true);
    assert.equal(observed.has(second), true);
    assert.equal(
      read(project, { ...relative, GOENV: "off" })?.values.GOENV,
      "off",
    );

    if (process.platform !== "win32") {
      const nested = path.join(other, "nested");
      fs.mkdirSync(nested);
      fs.symlinkSync(nested, path.join(project, "link"));
      const throughLink = read(project, {
        ...relative,
        GOENV: "link/../settings",
      });
      assert.equal(throughLink?.values.GOFLAGS, "-buildvcs=false");
      assert.equal(observed.has(`${project}/link/../settings`), true);
    }

    const neutral = systemTempOutsideProject(root, [project]);
    const reader = SourcePluginWorkspace.createGoModReader(
      tool,
      "settings",
      { ...relative, GOENV: path.relative(neutral, first) },
      undefined,
      undefined,
      root,
    );
    observed.clear();
    assert.equal(
      duringRecovery(() => reader.read(project)).modulePath,
      "example.com/settings",
    );
    assert.equal(observed.has(first), true);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
