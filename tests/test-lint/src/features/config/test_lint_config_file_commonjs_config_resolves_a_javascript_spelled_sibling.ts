import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies a CommonJS `.ts` lint config resolves a sibling written with the
 * JavaScript spelling TypeScript asks for.
 *
 * A config in a CommonJS package is evaluated as CommonJS, and Node evaluates a
 * CommonJS module reached through `import()` with the ESM translator's own
 * `require`. On the oldest Node ttsx supports that `require` never reaches
 * `module.registerHooks`, so `./rules.js` backed only by `rules.ts` failed to
 * resolve and the config could not load at all — while the same config loaded
 * on a newer Node, which routes that `require` through the hooks
 * (samchon/ttsc#1280).
 *
 * 1. Materialize a CommonJS fixture whose config imports `./rules.js`.
 * 2. Back that specifier with `rules.ts` alone.
 * 3. Run ttsc and assert the config loaded and its rule fired.
 */
export const test_lint_config_file_commonjs_config_resolves_a_javascript_spelled_sibling =
  () => {
    const result = runLint({
      name: "config-file-commonjs-js-spelling",
      source: SOURCE,
      pluginConfig: {
        configFile: "./ttsc-lint.config.ts",
      },
      extraSources: {
        "rules.ts": [
          `export const rules = { "no-console": "error" };`,
          ``,
        ].join("\n"),
        "ttsc-lint.config.ts": [
          `import { rules } from "./rules.js";`,
          ``,
          `export default { rules };`,
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
