import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx relative cache dir resolves from cwd option.
 *
 * When `--cache-dir` is a relative path, it must be resolved against `--cwd`
 * (the project directory), not against the shell's working directory. A user
 * might invoke ttsx from a different directory while pointing at a project
 * elsewhere; the cache must land inside that project.
 *
 * 1. Create a project under one temp directory and a separate driver cwd.
 * 2. Run ttsx with `--cwd <project>` and `--cache-dir .ttsx-cache` from the driver
 *    cwd.
 * 3. Assert the cache directory was created inside the project, not the driver
 *    cwd.
 */
export const test_ttsx_relative_cache_dir_resolves_from_cwd_option = () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `const message: string = "relative-runner-cache";\nconsole.log(message);\n`,
  });
  const driverCwd = TestProject.tmpdir("ttsx-driver-");
  const cacheDir = ".ttsx-cache";

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"],
    { cwd: driverCwd },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "relative-runner-cache");
  assert.equal(fs.existsSync(path.join(root, cacheDir, "project")), true);
  assert.equal(fs.existsSync(path.join(driverCwd, cacheDir, "project")), false);
};
