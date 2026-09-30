import {
  assert,
  createProject,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc -p &lt;directory&gt;` accepts a bare directory path (RC-3).
 *
 * Tsgo's own `-p` accepts either a tsconfig file path or the directory that
 * contains one; the directory form is the documented shorthand for a project
 * subfolder. Before the flag-schema cutover, ttsc's launcher classified a `-p`
 * value through `isBuildAlias` and only accepted `.json/.ts/.tsx/...`
 * extensions, so `ttsc -p packages/foo` exited 2 with "unknown command" even
 * though `tsgo -p packages/foo` would have worked. The schema's `--tsconfig`
 * entry no longer constrains the value to an extension list, so the launcher
 * hands the directory to tsgo which finds the tsconfig.
 *
 * 1. Create a project where the tsconfig lives in a subdirectory.
 * 2. Run `ttsc -p &lt;subdir&gt; --noEmit` from outside that subdirectory.
 * 3. Assert zero exit and no "unknown" error in stderr.
 *
 * @evidence contracts/testing.md#behavioral-verification From outside sub/, ttsc -p sub --noEmit must succeed without unknown-option/command diagnostics, showing the launcher accepts a directory operand and the real compiler selects its contained config.
 * @evidence contracts/testing.md#independent-expectations The only tsconfig is authored under sub with a valid number export; TypeScript project operands permit that directory. Literal zero status and absent parser rejection independently require public acceptance. No emitted artifact is expected or separately asserted.
 * @evidence contracts/testing.md#distinguishing-cases Directory-valued short project alias differs from explicit config-file paths in neighboring cases. The root contains no main config, preventing successful root-project checking from substituting for sub selection.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_dash_p_directory_path_is_accepted in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by TestSourceUnits.
 * @evidence contracts/e2e.md#necessary-boundary The launcher project operand and native compiler config discovery meet a real nested consumer layout. A parser unit accepting an arbitrary string cannot show the directory reaches compiler selection.
 * @evidence contracts/e2e.md#shared-execution One uniquely allocated consumer and the repository-built launcher/native compiler artifacts serve this entry. No plugin installation or contributor build occurs; the child process is required to exercise public command dispatch and returns synchronously with captured status/streams.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a unique TestProject directory, so authored config and emitted outputs cannot inherit another entry's result. spawn injects explicit workspace native and tsgo binary identities in the child environment without modifying the parent. The synchronous child has exited before assertions, and TestProject cleans temporary directories on runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_dash_p_directory_path_is_accepted. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
 */
export const test_ttsc_dash_p_directory_path_is_accepted = () => {
  const root = createProject({
    "sub/tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        noEmit: true,
        rootDir: ".",
      },
      include: ["main.ts"],
    }),
    "sub/main.ts": `export const x: number = 1;\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root, "-p", "sub", "--noEmit"], {
    cwd: root,
  });

  assert.equal(
    result.status,
    0,
    `stderr=${result.stderr}\nstdout=${result.stdout}`,
  );
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}`,
    /unknown (command|option)/i,
  );
};
