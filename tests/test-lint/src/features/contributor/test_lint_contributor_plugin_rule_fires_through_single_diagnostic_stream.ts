import {
  assert,
  createLintProject,
  runLintProject,
} from "../../internal/config-file";

/**
 * Verifies lint contributor protocol: `@ttsc/lint`'s `contributors` field
 * surfaces a third-party rule through the same diagnostic stream as the
 * built-in corpus.
 *
 * Pins the end-to-end path that the contributors design depends on: the JS
 * factory resolves the npm package, ttsc's plugin builder copies the
 * contributor's Go source into the host binary, the `init()` chain registers
 * `demo/no-todo-comment` before `main` runs, and the engine dispatches to it
 * through the same adapter as a built-in rule. A regression in any of those
 * stages would either drop the diagnostic or route it through a separate
 * stream, both of which violate the "single channel through @ttsc/lint"
 * invariant.
 *
 * 1. Materialize a lint fixture with one TODO comment and one FIXME comment in the
 *    source.
 * 2. Symlink the workspace `@ttsc/lint` and `lint-contributor-demo` packages into
 *    the temp project's `node_modules` so the JS factory's `require.resolve`
 *    reaches them.
 * 3. Run ttsc and assert both violations come out as `demo/no-todo-comment` errors
 *    under the standard `[rule] message` banner, with the rule name unchanged
 *    and the host's exit code non-zero.
 */
export const test_lint_contributor_plugin_rule_fires_through_single_diagnostic_stream =
  () => {
    const source =
      "// TODO: rewrite this loop\n" +
      "export const value = 1;\n" +
      "// FIXME: handle negative input\n" +
      "export const other = value + 1;\n";

    const project = createLintProject({
      name: "contributor-demo",
      source,
      pluginConfig: {
        plugins: { demo: "lint-contributor-demo" },
        rules: { "demo/no-todo-comment": "error" },
      },
      linkNodeModules: ["lint-contributor-demo"],
    });
    try {
      const result = runLintProject(project.tmpdir);

      assert.notEqual(
        result.status,
        0,
        `expected non-zero exit when contributor rule fires; stderr:\n${result.stderr}`,
      );
      const messages = result.diagnostics.map((d) => ({
        rule: d.rule,
        severity: d.severity,
        message: d.message,
      }));
      assert.deepEqual(
        messages,
        [
          {
            rule: "demo/no-todo-comment",
            severity: "error",
            message: "TODO comment is not allowed.",
          },
          {
            rule: "demo/no-todo-comment",
            severity: "error",
            message: "FIXME comment is not allowed.",
          },
        ],
        result.stderr,
      );
    } finally {
      project.cleanup();
    }
  };
