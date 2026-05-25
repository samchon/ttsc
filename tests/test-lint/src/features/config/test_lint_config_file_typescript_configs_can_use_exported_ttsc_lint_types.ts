import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a `.ts` lint config using `satisfies ITtscLintConfig` from
 * `@ttsc/lint` is evaluated correctly by ttsx.
 *
 * Pins the end-to-end TypeScript config path with type assertions. The config
 * uses `{ rules: { ... } } satisfies ITtscLintConfig` which is a compile-time
 * construct; ttsx must type-check and transpile it before the rules map can be
 * extracted. If `@ttsc/lint` is not resolvable during ttsx evaluation, the type
 * annotation fails and the config is rejected.
 *
 * 1. Materialise a fixture with a `.ts` config that imports and uses
 *    `ITtscLintConfig`.
 * 2. Run ttsc; assert the `no-var` rule from the config fires correctly.
 */
export const test_lint_config_file_typescript_configs_can_use_exported_ttsc_lint_types =
  () => {
    const result = runLint({
      name: "config-file-ts-satisfies-native-type",
      source: SOURCE,
      pluginConfig: {
        configFile: "./ttsc-lint.config.ts",
      },
      extraSources: {
        "ttsc-lint.config.ts": `import type { ITtscLintConfig } from "@ttsc/lint";

      const config = {
        rules: {
          "no-var": "error",
          "no-console": "off",
        },
      } satisfies ITtscLintConfig;

      export default config;\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-var", "error"]],
      result.stderr,
    );
  };
