import {
  assert,
  createProject,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies a malformed `tsconfig.json` is named on stderr and exits 2.
 *
 * This is the reported reproduction end to end: the launcher printed the raw V8
 * `JSON.parse` message, with no `ttsc:` prefix and no file name, telling the
 * user a byte offset in an unnamed file. The exit code was already right and
 * `compile.mdx` documents it, so the case pins both halves together — an
 * attributed message and the documented exit 2 — rather than only the reader's
 * throw, which the `features/project` cases cover.
 *
 * 1. Create a project whose `tsconfig.json` is left unterminated.
 * 2. Run `ttsc` against it.
 * 3. Assert exit 2 and a `ttsc:`-prefixed message naming that exact file.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs the launcher on an unclosed tsconfig object and requires status2, failed-to-parse wording and the exact authored config path in output.
 * @evidence contracts/testing.md#independent-expectations The deliberately truncated JSON is invalid independently of the compiler; the fixture filename supplies the diagnostic location oracle.
 * @evidence contracts/testing.md#distinguishing-cases This malformed-config negative differs from a missing config and from later watch repair. The specific error prevents a unrelated process failure from satisfying status2.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named feature and executes actual CLI startup.
 * @evidence contracts/e2e.md#necessary-boundary Real config-read failure must be reported through the launcher streams and exit status with its originating path; parser throw tests alone cannot prove command presentation.
 * @evidence contracts/e2e.md#shared-execution One launcher attempt supplies status/text/path checks using shared built artifacts and no plugin/native preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh registered malformed-config project owns the bytes and expected path; synchronous failure completes before assertions and suite cleanup removes it.
 * @evidence contracts/e2e.md#preserved-coverage All original status2, error-prefix and config-path assertions remain. Exact parser offset and absence of disk output are not checked.
 */
export const test_ttsc_names_the_malformed_tsconfig_and_exits_two = () => {
  const root = createProject({
    "tsconfig.json": `{ "compilerOptions": { "strict": true\n`,
    "src/main.ts": `export const value: number = 1;\n`,
  });

  const result = spawn(ttscBin, ["--cwd", root], { cwd: root });
  const output = `${result.stdout}${result.stderr}`;
  assert.equal(result.status, 2, output);
  assert.match(output, /ttsc: failed to parse /);
  assert.equal(
    output.includes(path.join(root, "tsconfig.json")),
    true,
    `the message must name the config that failed:\n${output}`,
  );
};
