import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";

/**
 * Verifies single-file emit rewrites allowImportingTsExtensions imports.
 *
 * Single-file compatibility mode also funnels through forced project emit, so
 * it must receive the same rewrite flag as `ttsc --emit`. The single-file path
 * materializes only the requested entry, so this pins the transformed source
 * contract rather than executing the dependency graph.
 *
 * 1. Create a CommonJS project importing a helper with a `.ts` specifier.
 * 2. Run `ttsc src/main.ts`.
 * 3. Assert the emitted JavaScript points at the rewritten `.js` file.
 *
 * @evidence contracts/testing.md#behavioral-verification Positional entry with helper.ts import exits zero and emitted main.js refers to helper.js.
 * @evidence contracts/testing.md#independent-expectations TypeScript emit rewrite contract fixes .ts specifier to .js when compatibility emit is forced; literal rewritten import is output oracle.
 * @evidence contracts/testing.md#distinguishing-cases allowImportingTsExtensions in single-file mode; dependency graph is not executed or materialized by this case.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_ttsc_single_file_rewrites_allow_importing_ts_extensions is discovered under features/compiler by @ttsc/test-ttsc src/index.ts/TestExecutor. It runs the built CLI through actual child processes; private helpers keep the cases and assertions above in this entry.
 * @evidence contracts/e2e.md#necessary-boundary Actual native emit flags and launcher entry materialization produce rewritten source visible on disk.
 * @evidence contracts/e2e.md#shared-execution One private fixture/project and installed workspace native binaries serve this entry. A single CLI invocation proves the stated boundary; its actual private native passes are owned by the launcher rather than repeated test setup. Related portable argument/path policies can run separately without this host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private tracked project isolates authored config and observed output paths from other cases. Synchronous spawn captures completion before disk/stdout assertions; toolchain overrides live only in the child environment. Root cleanup occurs at process exit; hung-child cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Positional entry with helper.ts import exits zero and emitted main.js refers to helper.js. No case is removed or transferred by these acknowledgments; the oracle limitations above remain explicit.
 */
export const test_ttsc_single_file_rewrites_allow_importing_ts_extensions =
  () => {
    const root = commonJsProject(
      FixtureFiles.read("ttsc/ttsc_single_file_rewrites_allow_importing_ts_extensions/inputs-1"),
      {
        compilerOptions: {
          allowImportingTsExtensions: true,
        },
      },
    );

    const result = spawn(ttscBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);

    const jsPath = path.join(root, "dist", "main.js");
    const js = fs.readFileSync(jsPath, "utf8");
    assert.match(js, /helper\.js/);
  };
