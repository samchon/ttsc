import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc --checkers <n>` is accepted and still builds the project.
 *
 * `--checkers` mirrors tsgo's flag for sizing the type-checker pool. ttsc's
 * launcher must parse the value, forward `--checkers <n>` to the tsgo
 * invocation, and not reject it as an unknown option. This pins that the flag
 * travels end-to-end and leaves the emitted output untouched.
 *
 * 1. Create a minimal CommonJS project.
 * 2. Run `ttsc --emit --checkers 2` and assert a zero exit.
 * 3. Assert `dist/main.js` is written with the expected export.
 */
export const test_ttsc_checkers_flag_builds_the_project = () => {
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
    "src/main.ts": `export const value: string = "checkers";\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--emit", "--checkers", "2"], {
    cwd: root,
  });
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /exports\.value/);
};
