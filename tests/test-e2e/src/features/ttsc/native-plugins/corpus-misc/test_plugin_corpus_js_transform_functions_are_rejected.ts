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
 * @evidence contracts/testing.md#distinguishing-cases Owns loader guard to CLI error transport; source/contributor distinctions now execute directly against their authored production guards.
 * @evidence contracts/testing.md#execution-ownership The matching named native export owns one real CLI invocation and is selected once by the shared Linux boundary runner.
 * @evidence contracts/e2e.md#necessary-boundary Production guard units cannot observe the isolated descriptor evaluator returning an object to the host guard and its error reaching the public CLI.
 * @evidence contracts/e2e.md#shared-execution No native producer is built for this preflight rejection; one consumer process retains common error transport rather than one per validation decision.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Temporary descriptor and project files are fresh and no native cache state or mutable descriptor result is shared.
 * @evidence contracts/e2e.md#preserved-coverage Keeps both original public exit and diagnostic assertions; five removed descriptor cases retain stricter exact messages and all meaningful value/path/duplicate distinctions in the authored validation unit.
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
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsupported JS transform functions/);
}
