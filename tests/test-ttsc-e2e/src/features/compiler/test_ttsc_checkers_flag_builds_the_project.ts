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
 *
 * @evidence contracts/testing.md#behavioral-verification A real --emit --checkers 2 invocation must exit zero and write CommonJS output exporting value. This catches launcher rejection or argument assembly breaking an otherwise valid native build.
 * @evidence contracts/testing.md#independent-expectations The authored exported value requires exports.value in generated CommonJS. Literal checker count 2 is accepted by the native option contract; successful emission alone cannot prove the compiler used exactly two workers rather than silently dropping the flag.
 * @evidence contracts/testing.md#distinguishing-cases Canonical positive integer plus forced emit owns the emitted-artifact connection. Signed/zero-padded accepted spellings have a separate surviving boundary entry; malformed numeric decisions execute in source parser units.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_checkers_flag_builds_the_project in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by the unit-module executor.
 * @evidence contracts/e2e.md#necessary-boundary The public launcher must accept the checker-pool option and reach actual native emit. Direct parser calls cannot prove adding that argument still leaves the emitted export intact.
 * @evidence contracts/e2e.md#shared-execution One uniquely allocated consumer and the repository-built launcher/native compiler artifacts serve this entry. No plugin installation or contributor build occurs; the child process is required to exercise public command dispatch and returns synchronously with captured status/streams.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a unique TestProject directory, so authored config and emitted outputs cannot inherit another entry's result. spawn injects explicit workspace native and tsgo binary identities in the child environment without modifying the parent. The synchronous child has exited before assertions, and TestProject cleans temporary directories on runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_checkers_flag_builds_the_project. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
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
