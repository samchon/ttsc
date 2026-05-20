import {
  assert,
  pluginProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

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
 */
export const test_plugin_corpus_js_transform_functions_are_rejected = () => {
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
};
