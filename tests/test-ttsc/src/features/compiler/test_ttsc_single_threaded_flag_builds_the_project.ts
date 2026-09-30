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
 * compiler. This case pins launcher acceptance and successful emission; it
 * does not observe how many threads the native compiler uses.
 *
 * 1. Create a minimal CommonJS project.
 * 2. Run `ttsc --emit --singleThreaded` and assert a zero exit.
 * 3. Assert `dist/main.js` is written with the expected export.
 *
 * @evidence contracts/testing.md#behavioral-verification --emit --singleThreaded exits zero and emitted main.js contains exports.value.
 * @evidence contracts/testing.md#independent-expectations TypeScript CommonJS output must export authored value; case checks accepted flag and output existence, not actual compiler thread count.
 * @evidence contracts/testing.md#distinguishing-cases Positive ttsc-owned singleThreaded invocation on plugin-free project.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_single_threaded_flag_builds_the_project is discovered under features/compiler by @ttsc/test-ttsc src/index.ts/TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Real launcher flag acceptance and native build execute; ignoring the thread setting would remain indistinguishable from applying it.
 * @evidence contracts/e2e.md#shared-execution One private fixture/project and installed workspace native binaries serve this entry. A single CLI invocation proves the stated boundary; its actual private native passes are owned by the launcher rather than repeated test setup. Related portable argument/path policies can run separately without this host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private tracked project isolates authored config and observed output paths from other cases. Synchronous spawn captures completion before disk/stdout assertions; toolchain overrides live only in the child environment. Root cleanup occurs at process exit; hung-child cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: --emit --singleThreaded exits zero and emitted main.js contains exports.value. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
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
