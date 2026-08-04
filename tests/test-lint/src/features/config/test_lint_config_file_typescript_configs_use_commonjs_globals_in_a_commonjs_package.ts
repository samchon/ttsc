import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies a `.ts` lint config in a CommonJS package is evaluated as CommonJS
 * and can name Node's globals without a triple-slash directive.
 *
 * Two independent defects met here (#1068). The loader tsconfig hardcoded
 * `module: "ESNext"`, so an ambiguous `.ts` config ran as an ES module however
 * the package was declared, and `__dirname` threw at evaluation. It also
 * declared no `types`, and TypeScript 7 gives a Program no ambient type package
 * unless asked, so `__dirname` did not even type-check — with no project-level
 * setting able to change either. `.cts` worked throughout, which is what proved
 * the CommonJS lane was fine and only the extension whose meaning comes from
 * `package.json` was misclassified.
 *
 * 1. Materialize a fixture with no `"type"` field, whose `configFile` is a `.ts`
 *    config that reads `__dirname` with no triple-slash reference.
 * 2. Run ttsc.
 * 3. Assert the config evaluated and its `no-console` rule fired.
 */
export const test_lint_config_file_typescript_configs_use_commonjs_globals_in_a_commonjs_package =
  () => {
    const result = runLint({
      name: "config-file-commonjs-globals",
      source: SOURCE,
      linkNodeModules: ["@types/node"],
      pluginConfig: {
        configFile: "./ttsc-lint.config.ts",
      },
      extraSources: {
        "ttsc-lint.config.ts": [
          `const here: string = __dirname;`,
          ``,
          `export default {`,
          `  rules: { "no-console": here.length > 0 ? "error" : "off" },`,
          `};`,
          ``,
        ].join("\n"),
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-console", "error"]],
      result.stderr,
    );
  };
