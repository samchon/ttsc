import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { GoToolResolution } from "../../../../../packages/ttsc/src/plugin/internal/source/GoToolResolution";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { readPluginBuildEnvironment } from "../../../../../packages/ttsc/src/plugin/internal/source/readPluginBuildEnvironment";
import { resolveGoCompiler } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveGoCompiler";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a warm build-environment load reuses its recorded answer when only
 * per-launch non-build variables move, while toolchain changes move it.
 *
 * Jobserver flags, direnv/cowshed state and shell session variables change
 * between launches without changing what Go or cgo reads. Keying the record on
 * them writes a new answer on every launch instead of replaying the recorded
 * one, while a real GOFLAGS change or an arbitrary wrapper variable must still
 * select a new record.
 *
 * 1. Read the build environment into a fresh cache with initial values.
 * 2. Reload with moved per-launch variables and verify record reuse.
 * 3. Move GOFLAGS and a custom variable and verify each writes a new record.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls readPluginBuildEnvironment with fresh PluginContentIdentities stores across consecutive loads and inspects the returned digests, persisted plugin-build-environment answer files, and record inode in the cache directory.
 * @evidence contracts/testing.md#independent-expectations Reusing a record leaves the persisted plugin-build-environment answer file set and inode unchanged with identical digest; distinct GOFLAGS values must change both the digest and the answer file set, and a non-excluded variable must produce a new answer file under the non-allowlist contract.
 * @evidence contracts/testing.md#distinguishing-cases Covers unchanged toolchain with moving per-launch variables (MAKEFLAGS, CARGO_MAKEFLAGS, COWSHED_INSTALL_OBSERVED, DIRENV_DIFF, DIRENV_WATCHES, OLDPWD, SHLVL) against real toolchain change (GOFLAGS) and an arbitrary non-excluded variable that a Go wrapper could read.
 * @evidence contracts/testing.md#execution-ownership Unit test under tests/test-ttsc calling maintained source-plugin environment readers directly against temporary directories owned by TestProject, without mutating process.env or building a native plugin binary.
 */
export function test_plugin_build_environment_reuses_record(): void {
  const root = TestProject.tmpdir("ttsc-build-env-reuse-");
  const projectDir = path.join(root, "project");
  const cacheDir = path.join(root, "cache");
  fs.mkdirSync(projectDir, { recursive: true });

  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    GOFLAGS: "-tags=ttsc_build_env_probe_a",
    MAKEFLAGS: "-j4 --jobserver-auth=fifo:/tmp/GMfifo1001",
    CARGO_MAKEFLAGS: "--jobserver-auth=fifo:/tmp/GMfifo1001",
    COWSHED_INSTALL_OBSERVED: "1001",
    DIRENV_DIFF: "diff-launch-1",
    DIRENV_WATCHES: "watches-launch-1",
    OLDPWD: "/tmp/oldpwd-launch-1",
    SHLVL: "2",
  };
  const goBinary = GoToolResolution.resolveGoToolForBuild(
    resolveGoCompiler(baseEnv).binary,
    baseEnv,
    projectDir,
  );

  const read = (env: NodeJS.ProcessEnv): string => {
    const store = PluginContentIdentities.open({
      projectRoot: projectDir,
      cacheDir,
      env,
    });
    assert.notEqual(store, undefined, "content identity store must open");
    return readPluginBuildEnvironment(
      goBinary,
      projectDir,
      env,
      new Map(),
      store,
    );
  };

  const firstDigest = read(baseEnv);
  const afterFirst = buildEnvironmentAnswerFiles(cacheDir);
  assert.equal(
    afterFirst.length,
    1,
    "first load records one plugin-build-environment answer",
  );
  const firstRecord = path.join(cacheDir, "answers", afterFirst[0]!);
  const firstInode = fs.statSync(firstRecord).ino;

  const secondEnv: NodeJS.ProcessEnv = {
    ...baseEnv,
    MAKEFLAGS: "-j4 --jobserver-auth=fifo:/tmp/GMfifo2002",
    CARGO_MAKEFLAGS: "--jobserver-auth=fifo:/tmp/GMfifo2002",
    COWSHED_INSTALL_OBSERVED: "2002",
    DIRENV_DIFF: "diff-launch-2",
    DIRENV_WATCHES: "watches-launch-2",
    OLDPWD: "/tmp/oldpwd-launch-2",
    SHLVL: "3",
  };
  const secondDigest = read(secondEnv);
  assert.equal(
    secondDigest,
    firstDigest,
    "per-launch non-build variables must not change the environment digest",
  );
  assert.deepEqual(
    buildEnvironmentAnswerFiles(cacheDir),
    afterFirst,
    "second load with only per-launch variables changed must reuse the existing record file",
  );
  assert.equal(
    fs.statSync(firstRecord).ino,
    firstInode,
    "second load must replay the existing record without rewriting it",
  );

  const changedGoFlagsEnv: NodeJS.ProcessEnv = {
    ...secondEnv,
    GOFLAGS: "-tags=ttsc_build_env_probe_b",
  };
  const changedGoFlagsDigest = read(changedGoFlagsEnv);
  assert.notEqual(
    changedGoFlagsDigest,
    firstDigest,
    "changing GOFLAGS must move the build environment digest",
  );
  const afterGoFlags = buildEnvironmentAnswerFiles(cacheDir);
  assert.equal(
    afterGoFlags.length,
    2,
    "changing GOFLAGS must record a distinct plugin-build-environment answer",
  );

  const customWrapperEnv: NodeJS.ProcessEnv = {
    ...secondEnv,
    TTSC_TEST_CUSTOM_WRAPPER_VAR: "variant-b",
  };
  read(customWrapperEnv);
  assert.equal(
    buildEnvironmentAnswerFiles(cacheDir).length,
    3,
    "an arbitrary non-excluded variable must still move the record key",
  );
}

/**
 * Return sorted answer filenames whose persisted family is
 * plugin-build-environment.
 */
function buildEnvironmentAnswerFiles(cacheDir: string): string[] {
  const answersDir = path.join(cacheDir, "answers");
  if (!fs.existsSync(answersDir)) return [];
  return fs
    .readdirSync(answersDir)
    .filter((name) => {
      if (!name.endsWith(".json")) return false;
      try {
        const parsed = JSON.parse(
          fs.readFileSync(path.join(answersDir, name), "utf8"),
        ) as { kind?: unknown };
        return parsed.kind === "plugin-build-environment";
      } catch {
        return false;
      }
    })
    .sort();
}
