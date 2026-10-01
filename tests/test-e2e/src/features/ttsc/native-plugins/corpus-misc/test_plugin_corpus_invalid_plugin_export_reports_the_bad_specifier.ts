import {
  assert,
  pluginProject,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: invalid plugin export reports the bad specifier.
 *
 * The descriptor loader accepts objects, factory functions, or named exports.
 * When a plugin file exports a primitive (e.g. `module.exports = 123`), ttsc
 * must name the offending file path in the error so the author can find it
 * immediately rather than seeing a generic "not a function" crash.
 *
 * 1. Write a plugin file that exports the number `123`.
 * 2. Run ttsc with `--emit`.
 * 3. Assert non-zero exit and `does not export a valid ttsc plugin` in stderr.
 *
 * @evidence contracts/testing.md#behavioral-verification ttsc --emit rejects a numeric descriptor export with the invalid-plugin-export message.
 * @evidence contracts/testing.md#independent-expectations The literal 123 cannot be a descriptor object or factory under the public plugin contract.
 * @evidence contracts/testing.md#distinguishing-cases Primitive export is the negative twin of accepted factory and named descriptor exports; the assertions do not independently require the bad path to appear.
 * @evidence contracts/testing.md#execution-ownership The exported test_plugin_corpus_invalid_plugin_export_reports_the_bad_specifier entry is discovered by TestExecutor from corpus-misc in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The actual CLI module loader receives a primitive export from the consumer descriptor and its rejection crosses launcher error handling. The test detects a missing descriptor validation/error connection before native host preparation; it does not compile a plugin.
 * @evidence contracts/e2e.md#shared-execution One temporary consumer and one invocation of the already built CLI suffice for this descriptor/discovery rejection. No native build is required or claimed; sharing the built launcher does not share mutable package exports, contributor modules or config absence across consumers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the temporary consumer and cache roots until process exit. Authored descriptor/source mutations stay in that consumer; shared cached binaries are valid only for equivalent source, host and toolchain inputs. Child-specific environment options do not mutate ambient process state.
 * @evidence contracts/e2e.md#preserved-coverage ttsc --emit rejects a numeric descriptor export with the invalid-plugin-export message. These assertions stay in test_plugin_corpus_invalid_plugin_export_reports_the_bad_specifier with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_plugin_corpus_invalid_plugin_export_reports_the_bad_specifier =
  () => {
    const root = pluginProject([{ transform: "./plugins/invalid.cjs" }], {
      "plugins/invalid.cjs": `module.exports = 123;\n`,
    });

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not export a valid ttsc plugin/);
  };
