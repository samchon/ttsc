import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a `.ts` lint config may default-export a bare rules map
 * (without wrapping it in `{ rules: ... }`).
 *
 * Pins the TypeScript config bare-export coercion path via ttsx. The loader
 * must recognise a plain object whose keys look like rule names as a flat rules
 * map. This is the simplest possible TypeScript config shape and should work
 * regardless of whether the user wraps rules in an `ITtscLintConfig`
 * structure.
 *
 * 1. Materialise a fixture with a `.ts` config that bare-exports a rules map.
 * 2. Run ttsc; assert `no-var` fires from the loaded config.
 */
export const test_lint_config_file_typescript_configs_may_default_export_the_rules_object =
  () => {
    const result = runLint({
      name: "config-file-ts",
      source: SOURCE,
      pluginConfig: {
        config: "./ttsc-lint.config.ts",
      },
      extraSources: {
        "ttsc-lint.config.ts": `export default {
        "no-var": "error",
        "no-console": "off",
      };\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-var", "error"]],
      result.stderr,
    );
  };
