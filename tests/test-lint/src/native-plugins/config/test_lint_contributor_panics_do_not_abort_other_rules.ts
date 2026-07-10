import {
  assert,
  createLintProject,
  runLintProject,
} from "../../internal/config-file";

/**
 * Verifies lint contributor panics do not abort other rules.
 *
 * Third-party contributors are statically linked into the @ttsc/lint binary, so
 * both their startup metadata and Check callbacks execute inside the host
 * process. Recoverable panics must disable only the broken registration or
 * become a rule diagnostic while healthy contributor and built-in rules keep
 * running.
 *
 * 1. Register one metadata-panicking, one Check-panicking, and one healthy rule.
 * 2. Enable the two runnable contributor rules together with built-in no-var.
 * 3. Run ttsc and assert every recoverable failure is isolated.
 * 4. Assert the healthy contributor and built-in rule still report findings.
 */
export const test_lint_contributor_panics_do_not_abort_other_rules = () => {
  const project = createLintProject({
    name: "contributor-panic-isolation",
    source: "var legacy = 1;\nvoid legacy;\n",
    pluginConfig: { configFile: "./lint.config.cjs" },
    extraSources: {
      "lint.config.cjs": `const path = require("node:path");
module.exports = {
  plugins: {
    broken: { source: path.resolve(__dirname, "contributor") },
  },
  rules: {
    "broken/check-panic": "error",
    "broken/healthy": "error",
    "no-var": "error",
  },
};
`,
      "contributor/rules.go": [
        "package broken",
        "",
        "import (",
        '\tshimast "github.com/microsoft/typescript-go/shim/ast"',
        '\t"github.com/samchon/ttsc/packages/lint/rule"',
        ")",
        "",
        "func init() {",
        "\trule.Register(metadataPanicRule{})",
        "\trule.Register(checkPanicRule{})",
        "\trule.Register(healthyRule{})",
        "}",
        "",
        "type metadataPanicRule struct{}",
        'func (metadataPanicRule) Name() string { panic("metadata boom") }',
        "func (metadataPanicRule) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindVariableStatement} }",
        "func (metadataPanicRule) Check(*rule.Context, *shimast.Node) {}",
        "",
        "type checkPanicRule struct{}",
        'func (checkPanicRule) Name() string { return "broken/check-panic" }',
        "func (checkPanicRule) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindVariableStatement} }",
        'func (checkPanicRule) Check(*rule.Context, *shimast.Node) { panic("check boom") }',
        "",
        "type healthyRule struct{}",
        'func (healthyRule) Name() string { return "broken/healthy" }',
        "func (healthyRule) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindVariableStatement} }",
        'func (healthyRule) Check(ctx *rule.Context, node *shimast.Node) { ctx.Report(node, "healthy contributor ran") }',
        "",
      ].join("\n"),
    },
  });
  try {
    const result = runLintProject(project.tmpdir);
    assert.notEqual(result.status, 0, result.stderr);
    assert.match(
      result.stderr,
      /contributor .*metadata panicked: metadata boom; dropping contributor entry/,
    );
    assert.doesNotMatch(result.stderr, /panic: metadata boom/);

    const rules = new Set(
      result.diagnostics.map((diagnostic) => diagnostic.rule),
    );
    assert.equal(rules.has("broken/check-panic"), true, result.stderr);
    assert.equal(rules.has("broken/healthy"), true, result.stderr);
    assert.equal(rules.has("no-var"), true, result.stderr);
  } finally {
    project.cleanup();
  }
};
