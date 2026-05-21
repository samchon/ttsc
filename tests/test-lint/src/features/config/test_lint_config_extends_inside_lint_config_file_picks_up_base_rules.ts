import {
  assert,
  createLintProject,
  runLintProject,
} from "../../internal/config-file";

/**
 * Verifies that a lint config file's `extends` string folds in a base config
 * file's rules.
 *
 * Pins the file-to-file `extends` composition: a config file may name another
 * config file via `extends: "./base.config.json"`, and the base file's rules
 * are folded in before the extending file's own rules apply. Without this,
 * users must inline every shared rule set instead of composing config files.
 *
 * 1. Materialize a fixture whose `lint.config.json` is a single object with
 *    `extends: "./base.config.json"` and no `rules` of its own.
 * 2. The base config file enables `no-var`; the source contains `var x = 1;`.
 * 3. Run ttsc; assert one inherited `no-var` error fires.
 */
export const test_lint_config_extends_inside_lint_config_file_picks_up_base_rules =
  () => {
    const source = "var value = 1;\nexport const ok = value;\n";
    const project = createLintProject({
      name: "config-file-extends",
      source,
      extraSources: {
        "lint.config.json": JSON.stringify({
          extends: "./base.config.json",
        }),
        "base.config.json": JSON.stringify({
          rules: { "no-var": "error" },
        }),
      },
    });
    try {
      const result = runLintProject(project.tmpdir);
      assert.notEqual(result.status, 0, result.stderr);
      assert.deepEqual(
        result.diagnostics.map((d) => [d.rule, d.severity]),
        [["no-var", "error"]],
        result.stderr,
      );
    } finally {
      project.cleanup();
    }
  };
