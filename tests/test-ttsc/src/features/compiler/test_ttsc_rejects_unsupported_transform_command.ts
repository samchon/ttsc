import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc rejects unsupported transform command.
 *
 * This ttsc compiler toolchain scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_rejects_unsupported_transform_command = () => {
  const root = createProject({
    "jsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
      },
      include: ["src"],
    }),
    "src/main.ts": `export const answer: number = 42;\n`,
  });

  const result = spawn(ttscBin, ["transform", "--cwd", root], { cwd: root });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown command "transform"/);
};
