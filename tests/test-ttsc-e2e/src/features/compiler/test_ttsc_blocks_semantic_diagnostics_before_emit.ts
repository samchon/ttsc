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
 * 1. Create a project with a type error (`number` assigned to `string`).
 * 2. Run the real `ttsc` launcher with `--emit`.
 * 3. Assert non-zero exit, the type-error message on stderr, and no
 *    `dist/main.js`.
 *
 * @evidence contracts/testing.md#behavioral-verification The real launcher receives --emit on a number-to-string assignment error; it must exit nonzero, print the exact assignability diagnostic to stderr and leave dist/main.js absent. This checks the CLI semantic gate rather than only checker failure.
 * @evidence contracts/testing.md#independent-expectations The literal source declares string and assigns 123, independently requiring a TypeScript diagnostic. The noEmitOnError contract forbids a newly emitted JS artifact after that error; output absence is the result of execution on a fresh consumer, not a committed-file arrangement check.
 * @evidence contracts/testing.md#distinguishing-cases Broken source with explicit forced emit is the owned failure boundary. The plain-project compile entry provides successful emit/runtime behavior, while disabled terminal flag owns the false-flag guard variant.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_blocks_semantic_diagnostics_before_emit in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by the unit-module executor.
 * @evidence contracts/e2e.md#necessary-boundary The shipped JS launcher invokes real TypeScript-Go and must translate checker failure into guarded emission and stderr/status. Direct type-check calls cannot establish the public --emit path keeps its guard.
 * @evidence contracts/e2e.md#shared-execution One uniquely allocated consumer and the repository-built launcher/native compiler artifacts serve this entry. No plugin installation or contributor build occurs; the child process is required to exercise public command dispatch and returns synchronously with captured status/streams.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a unique TestProject directory, so authored config and emitted outputs cannot inherit another entry's result. spawn injects explicit workspace native and tsgo binary identities in the child environment without modifying the parent. The synchronous child has exited before assertions, and TestProject cleans temporary directories on runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_blocks_semantic_diagnostics_before_emit. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
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
