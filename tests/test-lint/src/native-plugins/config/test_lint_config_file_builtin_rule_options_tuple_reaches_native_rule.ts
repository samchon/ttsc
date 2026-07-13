import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies a built-in rule's `[severity, options]` tuple in lint.config.json
 * reaches the native rule.
 *
 * `no-duplicate-imports` is the first bare-name core rule with typed options.
 * The contributor wire-chain test pins options delivery for contributor rules
 * and the Go unit layer pins the decoded semantics, but a release-only
 * declaration that advertises an option the native rule never enforces (the
 * forbidden shortcut named in issue #401) would still pass both. Spawning the
 * real binary closes that gap: the option must suppress the value/type pairing
 * while leaving the rule active for a mergeable pair in the same file, so
 * silence cannot be mistaken for a disabled rule.
 *
 * 1. Write a `lint.config.json` configuring `no-duplicate-imports` as `["error", {
 *    allowSeparateTypeImports: true }]`.
 * 2. Lint a file with one value import plus one clause-level type import of a
 *    module, and two mergeable named imports of another module.
 * 3. Assert exactly one diagnostic: the mergeable named pair.
 */
export const test_lint_config_file_builtin_rule_options_tuple_reaches_native_rule =
  () => {
    const result = runLint({
      name: "config-builtin-rule-options-tuple",
      source: [
        `import api from "separate-type-module";`,
        `import type { IEntity } from "separate-type-module";`,
        `import { alpha } from "duplicate-module";`,
        `import { beta } from "duplicate-module";`,
        `JSON.stringify({ api, alpha, beta });`,
        ``,
      ].join("\n"),
      extraSources: {
        "lint.config.json": JSON.stringify({
          rules: {
            "no-duplicate-imports": [
              "error",
              { allowSeparateTypeImports: true },
            ],
          },
        }),
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity, d.line]),
      [["no-duplicate-imports", "error", 4]],
      result.stderr,
    );
  };
