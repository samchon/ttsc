import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a tsconfig plugin entry may reference a standalone `.json` lint
 * config file via `configFile: "./ttsc-lint.config.json"`.
 *
 * Pins the JSON config extension branch. JSON files require neither ttsx nor a
 * CJS/ESM determination; they are parsed directly. Without this branch, teams
 * that prefer JSON-only config files would need a TypeScript or JS wrapper.
 *
 * 1. Materialise a fixture with a `.json` config file holding an `ITtscLintConfig`
 *    object.
 * 2. Run ttsc; assert `noVar` fires from the JSON config.
 */
export const test_lint_config_file_tsconfig_may_reference_a_standalone_json_file =
  () => {
    const result = runLint({
      name: "config-file-json",
      source: SOURCE,
      pluginConfig: {
        configFile: "./ttsc-lint.config.json",
      },
      extraSources: {
        "ttsc-lint.config.json": JSON.stringify({
          rules: { "noVar": "error" },
        }),
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["noVar", "error"]],
      result.stderr,
    );
  };
