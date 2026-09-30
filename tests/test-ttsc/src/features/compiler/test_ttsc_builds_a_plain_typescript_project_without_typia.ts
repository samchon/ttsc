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
 *
 * @evidence contracts/testing.md#behavioral-verification The real plugin-free --emit command must succeed and write CommonJS exports.add; executing that generated file with Node must exit zero and print exactly 5 for add(2,3). This catches plugin infrastructure breaking basic emit or runtime semantics.
 * @evidence contracts/testing.md#independent-expectations Literal arithmetic 2+3=5 and exported add follow the authored source independently of compiler output. The runtime oracle requires actual generated JS execution, so output text alone cannot satisfy it.
 * @evidence contracts/testing.md#distinguishing-cases A plugin-free valid CommonJS consumer owns the baseline; the semantic-gate entry covers broken source and no emit. This case checks both exported function emission and observed runtime result.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_builds_a_plain_typescript_project_without_typia in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by TestSourceUnits.
 * @evidence contracts/e2e.md#necessary-boundary The shipped launcher, native compiler emitted artifact and Node runtime connect in sequence. Unit emit helpers cannot demonstrate the real --emit command writes runnable output.
 * @evidence contracts/e2e.md#shared-execution One uniquely allocated consumer and the repository-built launcher/native compiler artifacts serve this entry. No plugin installation or contributor build occurs; the child process is required to exercise public command dispatch and returns synchronously with captured status/streams. The one emitted artifact is passed directly to one Node child; no recompile is needed to establish its runtime result.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a unique TestProject directory, so authored config and emitted outputs cannot inherit another entry's result. spawn injects explicit workspace native and tsgo binary identities in the child environment without modifying the parent. The synchronous child has exited before assertions, and TestProject cleans temporary directories on runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_builds_a_plain_typescript_project_without_typia. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
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
