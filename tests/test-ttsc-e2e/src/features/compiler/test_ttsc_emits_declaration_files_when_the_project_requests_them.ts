import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies ttsc emits declaration files when the project requests them.
 *
 * Pins the `declaration: true` contract through the real launcher binary. Both
 * `dist/main.js` and `dist/main.d.ts` must be written when the tsconfig enables
 * declarations. Validates that the default (no `--emit` flag) command surface
 * still respects the tsconfig-level declaration option without requiring an
 * extra CLI flag.
 *
 * 1. Create a project with `declaration: true` in tsconfig.
 * 2. Run `ttsc --cwd <root>` (no extra flags).
 * 3. Assert both `dist/main.js` and `dist/main.d.ts` exist on disk.
 *
 * @evidence contracts/testing.md#behavioral-verification The real default command with declaration:true must succeed and create both dist/main.js and dist/main.d.ts, detecting a launcher profile that discards config declaration emission unless --emit is supplied.
 * @evidence contracts/testing.md#independent-expectations The authored declaration:true and exported Box/box require both runtime and type artifacts under the selected output directory. Existence checks observe newly generated outputs on a fresh consumer, not committed files; declaration content correctness is not asserted here.
 * @evidence contracts/testing.md#distinguishing-cases Config-requested declaration emission with no explicit --emit owns the default lane. Ordinary forced emit and declaration-only/config forwarding variants have separate entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_emits_declaration_files_when_the_project_requests_them in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by the unit-module executor.
 * @evidence contracts/e2e.md#necessary-boundary The default public launcher profile must preserve native declaration emission into the real consumer filesystem. Unit configuration reads cannot prove both artifact classes are written.
 * @evidence contracts/e2e.md#shared-execution One uniquely allocated consumer and the repository-built launcher/native compiler artifacts serve this entry. No plugin installation or contributor build occurs; the child process is required to exercise public command dispatch and returns synchronously with captured status/streams.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity createProject allocates a unique TestProject directory, so authored config and emitted outputs cannot inherit another entry's result. spawn injects explicit workspace native and tsgo binary identities in the child environment without modifying the parent. The synchronous child has exited before assertions, and TestProject cleans temporary directories on runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_emits_declaration_files_when_the_project_requests_them. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
 */
export const test_ttsc_emits_declaration_files_when_the_project_requests_them =
  () => {
    const root = createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          declaration: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts": `export interface Box<T> { value: T }\nexport const box = <T>(value: T): Box<T> => ({ value });\n`,
    });

    const result = spawn(ttscBin, ["--cwd", root], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), true);
    assert.equal(fs.existsSync(path.join(root, "dist", "main.d.ts")), true);
  };
