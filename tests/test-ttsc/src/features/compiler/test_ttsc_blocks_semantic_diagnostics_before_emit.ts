import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc blocks semantic diagnostics before emit.
 *
 * Pins the CLI-level semantic gate against the real launcher binary. A type
 * error must cause a non-zero exit and print the diagnostic on stderr without
 * writing any JavaScript to the output directory. Companion to the corpus
 * variant; exercises the default (non-corpus-wrapper) command surface.
 *
 * 1. Create a project with a type error (`string` assigned to `number`).
 * 2. Run the real `ttsc` launcher with `--emit`.
 * 3. Assert non-zero exit, the type-error message on stderr, and no
 *    `dist/main.js`.
 */
export const test_ttsc_blocks_semantic_diagnostics_before_emit = () => {
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
    "src/main.ts": `const value: string = 123;\nconsole.log(value);\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Type 'number' is not assignable to type 'string'/,
  );
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
};
