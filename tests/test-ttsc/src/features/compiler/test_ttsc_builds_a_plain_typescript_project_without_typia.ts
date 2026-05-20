import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc builds a plain TypeScript project without any plugins.
 *
 * The most basic contract: `ttsc --emit` on a pure TypeScript project (no
 * typia, no plugins) must produce runnable CommonJS output. Serves as a smoke
 * test for the compiler pipeline and ensures plain projects are not
 * accidentally broken by plugin-loading infrastructure changes.
 *
 * 1. Create a minimal CommonJS project with an addition function.
 * 2. Run `ttsc --emit` and assert `dist/main.js` is written with `exports.add`.
 * 3. Execute the output with Node and assert the printed result is `"5"`.
 */
export const test_ttsc_builds_a_plain_typescript_project_without_typia = () => {
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
    "src/main.ts": `export const add = (x: number, y: number): number => x + y;\nconsole.log(add(2, 3).toString());\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /exports\.add/);

  const run = spawn(process.execPath, [path.join(root, "dist", "main.js")], {
    cwd: root,
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "5");
};
