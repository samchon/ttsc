import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies a forwarded print-and-exit tsgo flag runs tsgo exactly once.
 *
 * Ttsc runs a `--noEmit` type-check pass before the emit pass. A tsgo flag that
 * prints and exits instead of building — such as `--showConfig` — would
 * otherwise run in both passes and print its output twice. ttsc skips the
 * pre-check when such a flag is forwarded, so the output appears exactly once.
 *
 * 1. Create a minimal project.
 * 2. Run `ttsc --showConfig`.
 * 3. Assert a zero exit and exactly one rendered config block.
 */
export const test_ttsc_showconfig_flag_runs_tsgo_once = () => {
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
    "src/main.ts": `export const value: string = "config";\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--showConfig"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  const blocks = result.stdout.split('"compilerOptions"').length - 1;
  assert.equal(blocks, 1, `expected one config block, got ${blocks}`);
};
