import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  assert,
  commonJsProject,
  fs,
  path,
  runNode,
  spawn,
  ttscBin,
} from "../../../internal/ttsc/internal/compiler-corpus";

/**
 * Verifies ttsc emit rewrites allowImportingTsExtensions imports.
 *
 * Forcing emit on a config that allows `.ts` import specifiers must add the
 * matching TypeScript-Go rewrite flag. Without it, the forced `--noEmit false`
 * profile turns an otherwise valid check-only config into TS5096.
 *
 * 1. Create a CommonJS project importing a helper with a `.ts` specifier.
 * 2. Run `ttsc --emit`.
 * 3. Assert the emitted JavaScript runs and points at the rewritten `.js` file.
 *
 * @evidence contracts/testing.md#behavioral-verification A real --emit compile of an allowImportingTsExtensions consumer must succeed, rewrite helper.ts to helper.js in emitted code, and execute with Node to print ttsc-emit-extension-ok.
 * @evidence contracts/testing.md#independent-expectations The authored helper exports the literal runtime message and main imports its .ts path. Generated .js specifier plus actual Node output independently require runnable rewrite, rather than only suppressing TS5096 or echoing a string.
 * @evidence contracts/testing.md#distinguishing-cases Forced emit on an otherwise check-compatible .ts import owns the rewrite flag connection. The plain-project entry owns plugin-free runtime emission without the extension boundary.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_ttsc_emit_rewrites_allow_importing_ts_extensions in features/compiler through the test-ttsc boundary runner. This named E2E entry owns its actual launcher invocations and local scenario loops; portable source units are dispatched separately by the unit-module executor.
 * @evidence contracts/e2e.md#necessary-boundary The public forced-emit profile reaches actual native import rewriting and then Node resolves the produced dependency. A unit flag decision cannot prove the emitted specifier loads its emitted helper.
 * @evidence contracts/e2e.md#shared-execution One commonJsProject with main/helper and the existing built compiler serve one capture and one Node runtime child. The emitted files are reused directly for runtime verification; no contributor build or reinstallation occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique consumer/dist paths isolate both source and generated helper. Shared test helpers inject workspace binary identities only into children, which exit synchronously; TestProject removes the consumer at runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, output and generated-artifact assertions remain in test_ttsc_emit_rewrites_allow_importing_ts_extensions. No assertion or case is removed or transferred; this entry retains its real launcher connection rather than claiming a parser unit executes it.
 */
export const test_ttsc_emit_rewrites_allow_importing_ts_extensions = () => {
  const root = commonJsProject(
    FixtureFiles.read("ttsc/ttsc_emit_rewrites_allow_importing_ts_extensions/inputs-1"),
    {
      compilerOptions: {
        allowImportingTsExtensions: true,
      },
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);

  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.match(js, /helper\.js/);

  const run = runNode(path.join(root, "dist", "main.js"), { cwd: root });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "ttsc-emit-extension-ok");
};
