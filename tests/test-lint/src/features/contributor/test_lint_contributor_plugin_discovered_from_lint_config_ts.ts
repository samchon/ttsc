import {
  assert,
  createLintProject,
  runLintProject,
} from "../../internal/config-file";

/**
 * Verifies contributor discovery through a flat-config `lint.config.ts`
 * `plugins` field, not just the tsconfig plugin entry.
 *
 * Pins the second contributor discovery surface added in the same commit as the
 * host's `contributors` field: when the user authors plugins the
 * ESLint-flat-config way (`plugins: { demo: demoPlugin }` next to `rules`),
 * `@ttsc/lint`'s factory must spawn ttsx to evaluate the .ts config, walk every
 * entry's `plugins` map, and forward the resolved source paths to ttsc's plugin
 * builder.
 *
 * 1. Materialize a fixture whose tsconfig only references `@ttsc/lint` (no
 *    `plugins` field) but points at an external `lint.config.ts`.
 * 2. The `lint.config.ts` imports the demo plugin object and lists it under
 *    `plugins: { demo: demoPlugin }` of a flat-config entry.
 * 3. Run ttsc; assert the demo rule fires the same way it does when the plugin is
 *    declared inline in tsconfig.
 */
export const test_lint_contributor_plugin_discovered_from_lint_config_ts =
  () => {
    const source = "// FIXME: this should fire\n" + "export const value = 1;\n";

    const project = createLintProject({
      name: "contributor-demo-lint-config-ts",
      source,
      pluginConfig: {
        extends: "./lint.config.ts",
      },
      extraSources: {
        "lint.config.ts": `import demoPlugin from "lint-contributor-demo";
import { defineConfig } from "@ttsc/lint";

export default defineConfig([
  {
    plugins: { demo: demoPlugin },
    rules: { "demo/no-todo-comment": "error" },
  },
]);
`,
      },
      linkNodeModules: ["lint-contributor-demo"],
    });
    try {
      const result = runLintProject(project.tmpdir);

      assert.notEqual(
        result.status,
        0,
        `expected non-zero exit when contributor rule fires via lint.config.ts; stderr:\n${result.stderr}`,
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
            message: "FIXME comment is not allowed.",
          },
        ],
        result.stderr,
      );
    } finally {
      project.cleanup();
    }
  };
