import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies ttsx relative cache dir resolves from cwd option.
 *
 * This ttsx runtime toolchain scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
