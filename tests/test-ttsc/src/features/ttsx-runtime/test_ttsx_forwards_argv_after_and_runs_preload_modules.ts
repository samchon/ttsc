import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies ttsx forwards argv after -- and runs preload modules.
 *
 * This ttsx runtime toolchain scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsx_forwards_argv_after_and_runs_preload_modules = () => {
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
    "preload.cjs": `globalThis.__ttsxPreload = "loaded";\n`,
    "src/main.ts": `
      declare const process: { argv: string[] };
      console.log(JSON.stringify({
        preload: (globalThis as any).__ttsxPreload,
        argv: process.argv.slice(2),
      }));
    `,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    [
      "--cwd",
      root,
      "-r",
      "./preload.cjs",
      "src/main.ts",
      "--",
      "--flag",
      "value",
    ],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    preload: "loaded",
    argv: ["--flag", "value"],
  });
};
