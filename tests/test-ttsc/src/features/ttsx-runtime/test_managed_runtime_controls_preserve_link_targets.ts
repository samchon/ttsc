import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ProcessOwnedDirectory } from "../../../../../packages/ttsc/src/launcher/internal/runtime/ProcessOwnedDirectory";
import { RuntimeDependencyPrebuild } from "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeDependencyPrebuild";
import { systemRuntimeRunCanChange } from "../../../../../packages/ttsc/src/launcher/internal/runtime/systemRuntimeRunCanChange";
import { writeRuntimeManifest } from "../../../../../packages/ttsc/src/launcher/internal/runtime/writeRuntimeManifest";

/**
 * Verifies that managed runtime control files stay within the qualified run.
 *
 * 1. Refuse a linked hint store, then publish a prebuild manifest on the ordinary
 *    store.
 * 2. Preserve outside bytes behind both hard-linked and symbolic manifest names.
 * 3. Refresh an owner record without changing another hard link to the old inode.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual prebuild entry reads its own remembered hint and calls the shared writer; the required manifest and owner writer use the same managed directory qualification.
 * @evidence contracts/testing.md#independent-expectations A separate external file supplies the exact bytes that each operation must preserve; the environment callback counts whether prebuild could reach launch.
 * @evidence contracts/testing.md#distinguishing-cases The linked store, hard-linked control file, ordinary manifest, and repeated ordinary owner refresh each exercise a separate decision; POSIX adds a symbolic leaf case.
 * @evidence contracts/testing.md#execution-ownership The test owns its temporary coordinates and removes junctions before recursive cleanup. Inspector selection prevents prebuild worker creation; one bounded Node child executes the authored owner preload from inside the run.
 */
export async function test_managed_runtime_controls_preserve_link_targets(): Promise<void> {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-managed-controls-")),
  );
  const system = path.join(root, "runtime");
  const project = path.join(root, "project");
  const config = path.join(project, "tsconfig.json");
  const run = path.join(system, "project", "run");
  const store = path.join(system, "runtime-builds");
  const externalStore = path.join(root, "foreign-store");
  const external = path.join(root, "outside.txt");
  const prebuild = path.join(run, "prebuild-manifest.json");
  const manifest = path.join(run, "runtime-manifest.json");
  const canChange = (directory: string) =>
    systemRuntimeRunCanChange(directory, system, [project]);
  const params = {
    runDir: run,
    store,
    tsconfig: config,
    plugins: undefined,
    canChange,
  };
  let prepared = 0;
  const start = () =>
    RuntimeDependencyPrebuild.start({
      ...params,
      projectRoot: project,
      systemProjectRoots: [project],
      environment: (file) => {
        assert.equal(file, prebuild);
        ++prepared;
        return { NODE_OPTIONS: "--inspect" };
      },
    });
  try {
    fs.mkdirSync(project);
    fs.writeFileSync(config, "{}");
    fs.mkdirSync(run, { recursive: true });
    fs.writeFileSync(external, "outside bytes");
    RuntimeDependencyPrebuild.note(run, config, canChange);
    RuntimeDependencyPrebuild.remember(params);

    fs.renameSync(store, externalStore);
    fs.symlinkSync(externalStore, store, "junction");
    try {
      await start()();
      assert.equal(prepared, 0);
      assert.equal(fs.existsSync(prebuild), false);
    } finally {
      if (process.platform === "win32") fs.rmdirSync(store);
      else fs.unlinkSync(store);
    }
    fs.renameSync(externalStore, store);

    fs.linkSync(external, prebuild);
    await start()();
    assert.equal(prepared, 0);
    assert.equal(fs.readFileSync(external, "utf8"), "outside bytes");
    assert.equal(fs.lstatSync(prebuild).nlink, 2);
    fs.unlinkSync(prebuild);
    await start()();
    assert.equal(prepared, 1);
    assert.equal(
      JSON.parse(fs.readFileSync(prebuild, "utf8")).projectRoot,
      project,
    );

    fs.linkSync(external, manifest);
    assert.throws(
      () => writeRuntimeManifest(manifest, { ready: true }, canChange),
      { code: "EEXIST" },
    );
    assert.equal(fs.readFileSync(external, "utf8"), "outside bytes");
    fs.unlinkSync(manifest);
    if (process.platform !== "win32") {
      fs.symlinkSync(external, manifest);
      assert.throws(
        () => writeRuntimeManifest(manifest, { ready: true }, canChange),
        { code: "EEXIST" },
      );
      assert.ok(fs.lstatSync(manifest).isSymbolicLink());
      fs.unlinkSync(manifest);
    }
    writeRuntimeManifest(manifest, { ready: true }, canChange);
    assert.equal(JSON.parse(fs.readFileSync(manifest, "utf8")).ready, true);

    ProcessOwnedDirectory.admit(run, process.pid, canChange);
    const owner = fs
      .readdirSync(run)
      .find((file) => file === `owner-${process.pid}.json`);
    assert.ok(owner);
    const ownerFile = path.join(run, owner);
    fs.unlinkSync(ownerFile);
    fs.linkSync(external, ownerFile);
    ProcessOwnedDirectory.admit(run, process.pid, canChange);
    assert.equal(fs.readFileSync(external, "utf8"), "outside bytes");
    assert.equal(fs.lstatSync(ownerFile).nlink, 1);
    ProcessOwnedDirectory.admit(run, process.pid, canChange);
    assert.equal(ProcessOwnedDirectory.ownership(run), "live");
    fs.unlinkSync(ownerFile);
    fs.mkdirSync(ownerFile);
    assert.equal(ProcessOwnedDirectory.ownership(run), "unknown");
    fs.rmdirSync(ownerFile);

    const source = new URL(
      "../../../../../packages/ttsc/src/launcher/internal/runtimeOwnerPreload.ts",
      import.meta.url,
    ).href;
    const unitLoader = new URL(
      "../../../../../config/register-unit-loader.mjs",
      import.meta.url,
    ).href;
    const child = spawnSync(
      process.execPath,
      [
        "--import",
        unitLoader,
        "--input-type=module",
        "-e",
        "await import(process.argv[1]); process.stdout.write(String(process.pid));",
        source,
      ],
      {
        cwd: run,
        encoding: "utf8",
        timeout: 10_000,
        env: {
          ...process.env,
          NODE_OPTIONS: undefined,
          TTSX_RUNTIME_MANIFEST: manifest,
          TTSX_RUNTIME_CACHE_DIR: system,
          TTSX_RUNTIME_RUN_DIR: run,
          TTSX_RUNTIME_RUNS_DIR: path.dirname(run),
          TTSX_RUNTIME_SYSTEM_PROJECTS: JSON.stringify([project]),
        },
      },
    );
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
    const recordedPid = Number(child.stdout);
    assert.ok(recordedPid > 0);
    assert.equal(
      JSON.parse(
        fs.readFileSync(path.join(run, `owner-${recordedPid}.json`), "utf8"),
      ).pid,
      recordedPid,
    );

    const foreignRun = path.join(root, "foreign-run");
    fs.renameSync(run, foreignRun);
    fs.symlinkSync(foreignRun, run, "junction");
    try {
      assert.throws(
        () =>
          writeRuntimeManifest(
            path.join(run, "another-manifest.json"),
            {},
            canChange,
          ),
        /unsafe system runtime manifest directory/,
      );
      assert.equal(
        fs.existsSync(path.join(foreignRun, "another-manifest.json")),
        false,
      );
    } finally {
      if (process.platform === "win32") fs.rmdirSync(run);
      else fs.unlinkSync(run);
    }
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
