import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: source plugin rejects ttsc-managed replacements.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize a source plugin that imports ttsc utility code and also owns a
 *    local replacement for the same printer shim module path.
 * 2. Execute the real ttsc source-plugin build path.
 * 3. Assert the named build report and exact managed-module rejection survive
 *    the public CLI. No compiler-process absence is inferred from this text.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --emit announces the plugin build then rejects its printer shim replacement by module name.
 * @evidence contracts/testing.md#independent-expectations The fixture explicitly replaces a host-managed TypeScript-Go shim, which plugins may not override.
 * @evidence contracts/testing.md#distinguishing-cases Managed local replacement is refused; the external ordinary replacement-target case owns permitted replacements.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_source_plugin_rejects_ttsc_managed_replacements entry is discovered by TestExecutor from corpus-source in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The CLI invokes source preparation with a real Go module carrying a forbidden printer replacement; the named build report and host-owned-module rejection must reach stderr. This is launcher-to-source-builder validation, not a successful native plugin run or an assertion of every publication/Go-process side effect.
 * @evidence contracts/e2e.md#shared-execution The copied forbidden-replacement module and initially empty private cache preserve actual source admission. Suite compiler and Go toolchain preparation are available for reuse; a canonical warm producer cannot replace this input, and the diagnostic does not count total preparation or prove minimum process cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject tracks the consumer and initially empty cache. Child-specific PATH/cache options do not mutate ambient state. Error, signal and numeric nonzero status distinguish launch failure from intentional rejection; synchronous return does not certify arbitrary descendants or loaded executable bytes.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --emit announces the plugin build then rejects its printer shim replacement by module name. These assertions stay in test_plugin_corpus_source_plugin_rejects_ttsc_managed_replacements with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_source_plugin_rejects_ttsc_managed_replacements =
  () => {
    const root = copyProject("go-source-plugin-managed-replace");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-managed-replace-");
    assert.deepEqual(fs.readdirSync(cacheDir), []);
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: cacheDir,
      },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(typeof result.status, "number");
    assert.notEqual(result.status, 0, result.stderr);
    assert.match(
      result.stderr,
      /building source plugin "go-source-plugin-managed-replace"/,
    );
    assert.match(
      result.stderr,
      /go\.mod replaces ttsc-managed module "github\.com\/microsoft\/typescript-go\/shim\/printer"/,
    );
  };
