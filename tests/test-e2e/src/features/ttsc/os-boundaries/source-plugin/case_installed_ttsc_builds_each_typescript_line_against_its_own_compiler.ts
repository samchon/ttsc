import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * The TypeScript 7.1 nightly whose `gitHead` is the 7.1 compiler target's pin.
 * Bumping the target pins a new nightly, and this case then names it.
 */
const TYPESCRIPT_7_1 = "7.1.0-dev.20261020.3";

/**
 * Verifies the installed ttsc builds a source plugin against the compiler of
 * the project's own TypeScript line, from one installation.
 *
 * Each ttsc release ships a 7.0 and a 7.1 compiler target. A project installing
 * `typescript@7.0.2` must get a plugin linked against the 7.0 compiler, and a
 * project installing the 7.1 nightly one linked against the 7.1 compiler, with
 * one cache entry per target that neither reuses (samchon/ttsc#1802). The
 * source units own line mapping and environment tagging; this case runs the
 * packed SDK, whose published files must carry both targets' shims.
 *
 * 1. Lay out a 7.0 project resolving the consumer's `typescript@7.0.2` and a 7.1
 *    project installing the pinned nightly, beside one probe plugin.
 * 2. Check the project with the installed CLI in each; the probe records
 *    `core.Version()` of the compiler it was linked against.
 * 3. Require the two versions, two cache entries, and a second check of each that
 *    rebuilds nothing.
 *
 * @evidence contracts/testing.md#behavioral-verification The installed ttsc CLI checks each project; the probe's recorded compiler version, the plugin cache entries and the absence of a build notice on the second run are the observed results.
 * @evidence contracts/testing.md#independent-expectations The 7.0 project expects its installed manifest version, and the 7.1 project the 7.1.0-dev version its pinned compiler declares; the nightly's gitHead must be the commit the 7.1 target pins, read from the repository's facade go.mod.
 * @evidence contracts/testing.md#distinguishing-cases One plugin source and one cache directory differ only by the project's installed TypeScript line; equal versions or one cache entry would expose a shared target, and a build notice on the repeat a target that misses its own entry.
 * @evidence contracts/testing.md#execution-ownership test_e2e_installation supplies its packed consumer; this case installs the 7.1 project's TypeScript and runs the installed CLI four times.
 * @evidence contracts/e2e.md#necessary-boundary Target selection, the packed shim trees and the Go workspace meet only in an installed source-plugin build; no source unit links a plugin against a compiler.
 * @evidence contracts/e2e.md#shared-execution The consumer's installation and one plugin cache serve all four checks.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The projects live in a fresh directory below the consumer, which the entry removes; the cache directory is tracked by TestProject.
 * @evidence contracts/e2e.md#preserved-coverage A new boundary; no existing assertion moves or is removed.
 */
export function case_installed_ttsc_builds_each_typescript_line_against_its_own_compiler(input: {
  /** The packed consumer, whose root installs `typescript@7.0.2`. */
  consumer: string;

  /** The installed ttsc package directory. */
  sdk: string;

  /** The repository root, for the fixture and the 7.1 target pin. */
  repository: string;

  /** Run pnpm in a directory. */
  pnpm: (args: string[], cwd: string) => void;
}): void {
  const fixture = path.join(
    input.repository,
    "tests",
    "test-e2e",
    "fixtures",
    "ttsc",
    "compiler-target-probe",
  );
  const root = fs.mkdtempSync(path.join(input.consumer, "compiler-target-"));
  TestProject.copyDirectory(
    path.join(fixture, "plugin"),
    path.join(root, "plugin"),
  );
  const projects = {
    "7.0": path.join(root, "typescript-7.0"),
    "7.1": path.join(root, "typescript-7.1"),
  } as const;
  for (const project of Object.values(projects))
    TestProject.copyDirectory(path.join(fixture, "project"), project);
  fs.writeFileSync(
    path.join(projects["7.1"], "package.json"),
    JSON.stringify({
      private: true,
      devDependencies: { typescript: TYPESCRIPT_7_1 },
    }),
  );
  input.pnpm(["install", "--ignore-scripts"], projects["7.1"]);

  const manifest = (project: string) =>
    JSON.parse(
      fs.readFileSync(
        path.join(project, "node_modules", "typescript", "package.json"),
        "utf8",
      ),
    ) as { version: string; gitHead?: string };
  const pin =
    /github\.com\/microsoft\/TypeScript\/tsc v\S+-([0-9a-f]{12})\b/.exec(
      fs.readFileSync(
        path.join(
          input.repository,
          "packages",
          "ttsc",
          "targets",
          "7.1",
          "facade",
          "core",
          "go.mod",
        ),
        "utf8",
      ),
    )?.[1];
  assert.ok(pin, "the 7.1 target pins a TypeScript/tsc commit");
  assert.equal(manifest(projects["7.1"]).version, TYPESCRIPT_7_1);
  assert.equal(
    manifest(projects["7.1"]).gitHead?.slice(0, 12),
    pin,
    `${TYPESCRIPT_7_1} must be the nightly of the 7.1 target's pinned commit`,
  );
  const expected = {
    "7.0": manifest(input.consumer).version,
    "7.1": "7.1.0-dev",
  } as const;
  assert.equal(expected["7.0"], "7.0.2");

  const cache = TestProject.tmpdir("ttsc-compiler-target-cache-");
  const env: NodeJS.ProcessEnv = { ...process.env, TTSC_CACHE_DIR: cache };
  delete env.TTSC_TSGO_BINARY;
  const entries = () =>
    fs
      .readdirSync(path.join(cache, "plugins"))
      .filter((name) => /^[0-9a-f]{32}$/.test(name))
      .sort();
  const check = (line: keyof typeof projects) => {
    const record = path.join(projects[line], "compiler-version.txt");
    fs.rmSync(record, { force: true });
    const result = childProcess.spawnSync(
      process.execPath,
      [path.join(input.sdk, "lib", "launcher", "ttsc.js")],
      { cwd: projects[line], encoding: "utf8", env },
    );
    assert.equal(
      result.status,
      0,
      `ttsc in the ${line} project:\n${result.stdout}\n${result.stderr}`,
    );
    assert.equal(fs.readFileSync(record, "utf8"), expected[line]);
    return result.stderr;
  };

  for (const line of ["7.0", "7.1"] as const)
    assert.match(check(line), /building source plugin "compiler-target-probe"/);
  const built = entries();
  assert.equal(built.length, 2, `one entry per target: ${built.join(", ")}`);
  for (const line of ["7.1", "7.0"] as const)
    assert.doesNotMatch(
      check(line),
      /building source plugin/,
      `the ${line} project reuses its own target's entry`,
    );
  assert.deepEqual(entries(), built);
}
