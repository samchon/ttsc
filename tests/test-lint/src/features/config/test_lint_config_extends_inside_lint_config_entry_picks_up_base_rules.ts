import {
  assert,
  createLintProject,
  runLintProject,
} from "../../internal/config-file";

/**
 * Verifies that flat-config entry-level `extends` folds in a child entry's
 * rules.
 *
 * Pins the in-config `extends` traversal at the lint config level (separate
 * from the tsconfig plugin entry's `extends` path that picks the file): a child
 * entry listed under `extends: [...]` should contribute its rules to the outer
 * entry before that outer entry's own rules apply. Without this, users must
 * inline every shared rule set instead of composing them.
 *
 * 1. Materialize a fixture whose `lint.config.ts` is a single entry with `extends:
 *    [{ rules: { "no-var": "error" } }]` and no top-level `rules`.
 * 2. Source contains `var x = 1;` to trigger the inherited rule.
 * 3. Run ttsc; assert one `no-var` error fires.
 */
export const test_lint_config_extends_inside_lint_config_entry_picks_up_base_rules =
  () => {
    const source = "var value = 1;\nexport const ok = value;\n";
    const project = createLintProject({
      name: "config-entry-extends",
      source,
      pluginConfig: { extends: "./lint.config.ts" },
      extraSources: {
        "lint.config.ts": `import { defineConfig } from "@ttsc/lint";

export default defineConfig([
  {
    extends: [{ rules: { "no-var": "error" } }],
  },
]);
`,
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
