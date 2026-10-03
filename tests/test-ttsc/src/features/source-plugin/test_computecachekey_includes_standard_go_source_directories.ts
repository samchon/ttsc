import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../internal/source-build-unit";

/**
 * Verifies computeCacheKey includes standard Go source directories.
 *
 * The declared source snapshot includes ordinary Go files in `vendor/`, `lib/`,
 * `dist/`, and `build/`, even when the entry does not import them. Each pair
 * changes one directory while retaining previously added directories; this
 * checks source identity rather than actual Go compilation membership.
 *
 * 1. Create a plugin with a helper file in one of the four standard directories.
 * 2. Compute the cache key before and after mutating the file.
 * 3. Assert the keys differ, then repeat for each remaining directory.
 *
 * @evidence contracts/testing.md#behavioral-verification Each vendor/lib/dist/build pair changes only its helper bytes in an accumulating source tree and must invalidate the key; every pair is collected before reporting failures.
 * @evidence contracts/testing.md#independent-expectations The declared snapshot policy selects ordinary Go files under these names regardless of whether the entry imports them. Literal Value 1 versus 2 changes selected bytes without claiming a compiled artifact.
 * @evidence contracts/testing.md#distinguishing-cases Each of vendor, lib, dist and build is mutated in turn with its own one-constant change, so an exclusion of any single subtree fails naming that directory.
 * @evidence contracts/testing.md#execution-ownership A unit test calling computeCacheKey directly on a temp Go module with no goBinary and no go.mod replace directive, so no Go process is spawned and no native build or consumer host is involved.
 */
export function test_computecachekey_includes_standard_go_source_directories() {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  const fixture = path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "test", "fixtures", "unit", "computecachekey_includes_standard_go_source_directories");
  TestProject.copyDirectory(path.join(fixture, "inputs-1"), root);
  fs.renameSync(path.join(plugin, "main.go.txt"), path.join(plugin, "main.go"));
  assert.equal(fs.readFileSync(path.join(plugin, "go.mod"), "utf8"), "module example.com/plugin\n\ngo 1.26\n");
  assert.equal(fs.readFileSync(path.join(plugin, "main.go"), "utf8"), "package main\n");

  const failures: unknown[] = [];
  for (const dirName of ["vendor", "lib", "dist", "build"]) {
    try {
    const file = path.join(plugin, dirName, "helper.go");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(path.join(fixture, `inputs-${dirName}-1`, "plugin", dirName, "helper.go.txt"), file);
    assert.equal(fs.readFileSync(file, "utf8"), `package ${dirName}\nconst Value = 1\n`);

    const first = computeCacheKey({
      dir: plugin,
      entry: ".",
      env: {},
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    fs.copyFileSync(path.join(fixture, `inputs-${dirName}-2`, "plugin", dirName, "helper.go.txt"), file);
    assert.equal(fs.readFileSync(file, "utf8"), `package ${dirName}\nconst Value = 2\n`);
    const second = computeCacheKey({
      dir: plugin,
      entry: ".",
      env: {},
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.notEqual(first, second, `${dirName} was excluded from the key`);
    } catch (error) { failures.push(error); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "Selected source directory identity failures");
}
