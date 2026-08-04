import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies a `.ts` lint config in a `"type": "module"` package is still
 * evaluated as an ES module.
 *
 * The negative twin of the CommonJS-package case. Deriving the loader's
 * `module` option from the nearest `package.json` fixes `__dirname` in a
 * CommonJS package, but a fix that simply swapped the hardcoded answer would
 * break every ESM config instead — `import.meta` is a syntax error under a
 * CommonJS emit. Both directions have to follow the manifest, which is what
 * makes the manifest, rather than either constant, the rule.
 *
 * 1. Materialize a fixture whose `package.json` declares `"type": "module"` and
 *    whose `configFile` is a `.ts` config reading `import.meta.url`.
 * 2. Run ttsc.
 * 3. Assert the config evaluated and its `no-console` rule fired.
 */
export const test_lint_config_file_typescript_configs_use_import_meta_in_a_module_package =
  () => {
    const result = runLint({
      name: "config-file-module-import-meta",
      source: SOURCE,
      pluginConfig: {
        configFile: "./ttsc-lint.config.ts",
      },
      extraSources: {
        "package.json": `${JSON.stringify(
          { name: "module-package-fixture", version: "1.0.0", type: "module" },
          null,
          2,
        )}\n`,
        "ttsc-lint.config.ts": [
          `const here: string = import.meta.url;`,
          ``,
          `export default {`,
          `  rules: { "no-console": here.startsWith("file:") ? "error" : "off" },`,
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
