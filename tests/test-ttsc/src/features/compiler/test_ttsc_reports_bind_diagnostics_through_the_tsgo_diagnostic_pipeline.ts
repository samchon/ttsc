import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc reports bind-phase diagnostics through the tsgo pipeline.
 *
 * Bind errors (e.g. duplicate `let` declarations) are reported during the bind
 * phase, not the type-check phase. Pins that these errors reach stderr through
 * the same diagnostic pipeline as semantic errors and still prevent emit,
 * ensuring no category of compiler error is silently swallowed between the Go
 * backend and the JS launcher.
 *
 * 1. Create a project with a duplicate `let value` declaration in the same scope.
 * 2. Run `ttsc --emit`.
 * 3. Assert non-zero exit, the redeclaration message on stderr, and no
 *    `dist/main.js`.
 */
export const test_ttsc_reports_bind_diagnostics_through_the_tsgo_diagnostic_pipeline =
  () => {
    const root = createProject({
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
      "src/main.ts": `let value = 1;\nlet value = 2;\nconsole.log(value);\n`,
    });

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Cannot redeclare block-scoped variable 'value'/,
    );
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  };
