import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc forwards two space-valued tsgo flags to the build with each
 * flag still adjacent to its own value.
 *
 * The old parser split every unknown flag from its bare value and rebuilt the
 * stream as `[...flags, ...values]`, so `--target es2020 --module commonjs`
 * reached tsgo as `--target --module es2020 commonjs`. tsgo then reads
 * `--module` as the value of `--target`, rejects it as an invalid target, and
 * the build fails. A build that succeeds and emits proves each value stayed
 * with its flag.
 *
 * 1. Create a minimal project.
 * 2. Run `ttsc --emit --target es2020 --module commonjs`.
 * 3. Assert a zero exit and that the project's JavaScript was emitted.
 */
export const test_ttsc_preserves_two_spaced_tsgo_flag_pairs_in_order = () => {
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
    "src/main.ts": `export const value: string = "ordered";\n`,
  });

  const result = spawn(
    ttscBin,
    ["--cwd", root, "--emit", "--target", "es2020", "--module", "commonjs"],
    { cwd: root },
  );
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  assert.ok(fs.existsSync(path.join(root, "dist", "main.js")));
};
