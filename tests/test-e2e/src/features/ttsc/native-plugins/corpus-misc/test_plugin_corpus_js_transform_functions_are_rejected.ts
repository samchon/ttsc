import {
  assert,
  pluginProject,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: JS transform functions are rejected.
 *
 * The ttsc plugin model requires all transform logic to live in Go so the host
 * can share the TypeScript-Go AST/Checker across plugins. A descriptor that
 * carries a JS `transformOutput` or `transformSource` function cannot be lifted
 * into the Go pipeline, so ttsc must refuse it with a clear `unsupported JS
 * transform functions` message rather than silently ignoring the function.
 *
 * 1. Write a plugin descriptor that includes a `transformOutput` JS function.
 * 2. Run ttsc with `--emit`.
 * 3. Assert non-zero exit and `unsupported JS transform functions` in stderr.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsc must reject the prohibited JavaScript transform descriptor with nonzero status and the unsupported-transform diagnostic.
 * @evidence contracts/testing.md#independent-expectations The descriptor explicitly authors a transformOutput function; the literal diagnostic and nonzero exit are independent expected public error outcomes.
 * @evidence contracts/testing.md#distinguishing-cases Owns loader guard to CLI error transport; source/contributor distinctions have the separate authored direct owner test_descriptor_validation_preserves_source_and_contributor_rejections; that body does not certify its current execution or native transport.
 * @evidence contracts/testing.md#execution-ownership The matching named native export owns one real CLI invocation and is selected by the generic corpus-misc runner without a platform filter in this body.
 * @evidence contracts/e2e.md#necessary-boundary Production guard units cannot observe the isolated descriptor evaluator returning an object to the host guard and its error reaching the public CLI.
 * @evidence contracts/e2e.md#shared-execution One CLI request retains this distinct prohibited-function error transport. No successful native build is asserted or earlier runtime/tool preparation counted; remaining preparation minimality is a measurement obligation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Descriptor/project files are fresh, with no explicit private plugin-cache override here. Direct synchronous result and TestProject cleanup do not prove cache absence or arbitrary descendant shutdown.
 * @evidence contracts/e2e.md#preserved-coverage Keeps both original public exit and diagnostic assertions; the authored tests/test-ttsc/src/features/compiler/test_descriptor_validation_preserves_source_and_contributor_rejections.ts retains absent/empty/nonstring source, missing path, contributor order/name/duplicate/source cases with exact messages and native temporary inputs, selected by the ordinary unit runner. Its body is not a current PASS or removal authorization. Generated evaluator-to-serialization key preservation has separate owner test_plugin_descriptor_shims_reject_js_transform_properties_before_serializing; that unit does not execute module loading/native transport.
 */
export function test_plugin_corpus_js_transform_functions_are_rejected(): void {
  const root = pluginProject(
    [{ transform: "./plugins/invalid-js-transform.cjs" }],
    {
      "plugins/invalid-js-transform.cjs": `
        module.exports = {
          name: "invalid-js-transform",
          transformOutput(context) {
            return context.code;
          },
        };
      `,
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(typeof result.status, "number", result.stderr);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsupported JS transform functions/);
}
