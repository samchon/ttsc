import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies `ttsc --pretty <file>.ts` stays in single-file mode.
 *
 * `--pretty` is a boolean upstream, but the schema declared it value-taking, so
 * the forwarding path removed the following token from `positional` on its
 * behalf. The visible failure is a _lane switch_ before it is an error: with no
 * input file left, the launcher fell into project mode, added `-p`, and tsgo
 * rejected the mix with TS5042. A parser-level assertion cannot see that, so
 * this case drives the real launcher.
 *
 * 1. Create a project and a source file.
 * 2. Run `ttsc --pretty src/main.ts`.
 * 3. Assert a zero exit, no TS5042, and the single-file emit on disk.
 *
 * @evidence contracts/testing.md#behavioral-verification --pretty followed by positional main.ts exits zero, produces dist/main.js and no TS5042.
 * @evidence contracts/testing.md#independent-expectations Upstream pretty boolean consumes no filename; successful emit and missing mixed-file/project diagnostic expose lane switch.
 * @evidence contracts/testing.md#distinguishing-cases Boolean option directly before positional file, rather than project-only invocation.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_single_file_mode_survives_a_forwarded_pretty_flag is discovered under features/compiler by @ttsc/test-ttsc src/index.ts/TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Actual launcher forwarding and native mode selection reveal filename token loss beyond argument parser shape.
 * @evidence contracts/e2e.md#shared-execution One private fixture/project and installed workspace native binaries serve this entry. A single CLI invocation proves the stated boundary; its actual private native passes are owned by the launcher rather than repeated test setup. Related portable argument/path policies can run separately without this host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private tracked project isolates authored config and observed output paths from other cases. Synchronous spawn captures completion before disk/stdout assertions; toolchain overrides live only in the child environment. Root cleanup occurs at process exit; hung-child cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: --pretty followed by positional main.ts exits zero, produces dist/main.js and no TS5042. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_single_file_mode_survives_a_forwarded_pretty_flag =
  () => {
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
      "src/main.ts": `export const value: string = "pretty";\n`,
    });

    const result = spawn(ttscBin, ["--cwd", root, "--pretty", "src/main.ts"], {
      cwd: root,
    });
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(
      /TS5042/.test(`${result.stdout}${result.stderr}`),
      false,
      `the run must stay in single-file mode:\n${result.stdout}${result.stderr}`,
    );
    assert.equal(
      fs.existsSync(path.join(root, "dist", "main.js")),
      true,
      `${result.stdout}${result.stderr}`,
    );
  };
