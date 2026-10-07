package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusRestrictTemplateExpressions verifies an authored typed trigger for the lint rule
// typescript/restrict-template-expressions under a real Program.
//
// `typescript/restrict-template-expressions` is type-aware: it reads each `${expr}`
// slot's static type via `ctx.Checker.GetTypeAtLocation`. It accepts primitive
// string-like types and exempts any, unknown and never; this input's object type
// is rejected. A parser-only engine run skips the
// rule because Context.Checker is nil, so this Go scenario reuses the
// `seedLintProject` shape from `only-throw-error` and `require-array-sort-compare`:
// materialize a tsconfig project, run `ttsc lint check`, and assert on the rendered
// diagnostics.
//
// 1. Seed a project that interpolates an object value into a template.
// 2. Run `check` with typescript/restrict-template-expressions enabled.
// 3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification Object interpolation must report unsupported conversion.
// @evidence contracts/testing.md#independent-expectations The original authored input fixes exactly one typescript/restrict-template-expressions rendered error at line 2, code 2 and empty stdout; its independently authored typed counterpart requires code 0 and no rule errors.
// @evidence contracts/testing.md#distinguishing-cases String interpolation retains the template shape with a supported operand.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusRestrictTemplateExpressions invokes the in-process check command and shared typed semantic oracles over real Program/Checker instances; fixture configuration feeds that operation without a native build, child compiler or installed consumer.
func TestRuleCorpusRestrictTemplateExpressions(t *testing.T) {
  root := seedLintProject(t, `declare const obj: { id: number };
const s = `+"`"+`value=${obj}`+"`"+`;
JSON.stringify({ s });
`)
  seedLintRules(t, root, map[string]string{"typescript/restrict-template-expressions": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/restrict-template-expressions]") {
    t.Fatalf("restrict-template-expressions diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/restrict-template-expressions", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/restrict-template-expressions", "declare const value: string;\nconst s = `value=${value}`;\n")
}
