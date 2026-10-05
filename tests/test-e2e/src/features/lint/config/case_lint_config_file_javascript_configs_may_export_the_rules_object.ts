import {
  SOURCE,
  assert,
  runLint,
} from "../../../internal/lint/internal/config-file";

/**
 * Verifies that a `.cjs` lint config exports an `ITtscLintConfig` object via
 * `module.exports = { rules: { ... } }`.
 *
 * Pins the CommonJS config-file loader. The loader must accept the
 * `module.exports` object and read its `rules` map. The test also verifies
 * severity normalisation: the string `"warning"` must render as `"warn"` in the
 * diagnostic output.
 *
 * 1. Materialise a fixture with a `.cjs` config that exports `{ rules: {
 *    "no-console": "warning" } }`.
 * 2. Run ttsc; assert the diagnostic severity is `"warn"` (not `"warning"`).
 *
 * @evidence contracts/testing.md#behavioral-verification The actual launcher evaluates the explicit CJS module.exports config with warning severity, renders exactly one no-console warn and returns successful status zero.
 * @evidence contracts/testing.md#independent-expectations The authored config enables only no-console with the supported warning spelling; the source contains its single console call and the public warning-only process contract requires success.
 * @evidence contracts/testing.md#distinguishing-cases This warning-only CJS execution distinguishes normalized warn diagnostics from error findings and detects incorrectly failing the process for a warning. It cannot be substituted by an error-containing language batch.
 * @evidence contracts/testing.md#execution-ownership This named entry runs the real launcher and checks both parsed diagnostic severity and process exit; the exact warning input spelling, rendered warn and successful CLI status remain this boundary contribution. The direct TestParseConfigStoreAcceptsSeverityTuples owner separately checks warn/numeric/error tuple normalization; that different input is not proof of this CJS warning spelling or launcher exit.
 * @evidence contracts/e2e.md#necessary-boundary CJS config loading, native severity transport, renderer normalization and the launcher's warning-only successful exit must connect in the product process.
 * @evidence contracts/e2e.md#shared-execution One CJS fixture and one launcher call jointly verify normalized warning and exit zero. TestLint.runProject supplies workspace-selected launcher/tool and shared cache paths, without this test certifying actual artifact identity or a cache hit. A separate warning-only execution is needed because an error batch would make successful exit unobservable.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Immutable source/config inputs belong to a fresh TestLint project cleaned by its runner; another project's diagnostic result or error exit is not reused. runLint attempts cleanup in finally, and its synchronous returned result is not arbitrary descendant or loaded-image certification.
 * @evidence contracts/e2e.md#preserved-coverage The original explicit standalone CJS pointer, warning spelling, exact one no-console/warn finding and zero-status assertion remain executable.
 */
export function test_lint_config_file_javascript_configs_may_export_the_rules_object() {
  const result = runLint({
    name: "config-file-js",
    source: SOURCE,
    pluginConfig: {
      configFile: "./ttsc-lint.config.cjs",
    },
    extraSources: {
      "ttsc-lint.config.cjs": `module.exports = {
        rules: { "no-console": "warning" },
      };\n`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["no-console", "warn"]],
    result.stderr,
  );
}
