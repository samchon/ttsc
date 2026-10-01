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
 * Helper code in `vendor/`, `lib/`, `dist/`, and `build/` subdirectories is
 * compiled into the plugin binary. If any of those files changes, the cache
 * must produce a new key. This test exercises each directory in isolation so a
 * regression in any one sub-path fails with a precise error message.
 *
 * 1. Create a plugin with a helper file in one of the four standard directories.
 * 2. Compute the cache key before and after mutating the file.
 * 3. Assert the keys differ, then repeat for each remaining directory.
 *
 * @evidence contracts/testing.md#behavioral-verification Independent vendor/lib/dist/build helper mutations each invalidate the key, proving no source subtree is incorrectly excluded.
 * @evidence contracts/testing.md#independent-expectations Go can compile helper code under vendor, lib, dist and build; none is a generic generated-source exclusion in the source-plugin contract.
 * @evidence contracts/testing.md#distinguishing-cases Each of vendor, lib, dist and build is mutated in turn with its own one-constant change, so an exclusion of any single subtree fails naming that directory.
 * @evidence contracts/testing.md#execution-ownership This matching named source-unit entry directly executes the authored hashing owner over fixture bytes without a Go executable, native artifact or consumer host; actual build and toolchain probes remain separate boundaries.
 */
export function test_computecachekey_includes_standard_go_source_directories() {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");

  for (const dirName of ["vendor", "lib", "dist", "build"]) {
    const file = path.join(plugin, dirName, "helper.go");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `package ${dirName}\nconst Value = 1\n`, "utf8");

    const first = computeCacheKey({
      dir: plugin,
      entry: ".",
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    fs.writeFileSync(file, `package ${dirName}\nconst Value = 2\n`, "utf8");
    const second = computeCacheKey({
      dir: plugin,
      entry: ".",
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.notEqual(first, second, `${dirName} was excluded from the key`);
  }
}
