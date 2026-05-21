import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc --singleThreaded` is accepted and still builds the project.
 *
 * `--singleThreaded` mirrors tsgo's flag of the same name. It is a ttsc-owned
 * flag — parsed explicitly and plumbed into the in-process program, not blindly
 * forwarded — so it must be recognized by ttsc's launcher and reach the
 * compiler. This pins that the flag travels end-to-end and leaves the emitted
 * output untouched.
 *
 * 1. Create a minimal CommonJS project.
 * 2. Run `ttsc --emit --singleThreaded` and assert a zero exit.
 * 3. Assert `dist/main.js` is written with the expected export.
 */
export const test_ttsc_single_threaded_flag_builds_the_project = () => {
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
    "src/main.ts": `export const value: string = "single";\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--emit", "--singleThreaded"], {
    cwd: root,
  });
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /exports\.value/);
};
