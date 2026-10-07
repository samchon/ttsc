package linthost

import (
  "strings"
  "testing"
)

// TestRuleCorpusNoUnnecessaryTemplateExpression verifies a reduced trigger from the lint rule
// corpus fixture typescript-no-unnecessary-template-expression.ts under
// a real Program.
//
// This string-typed identifier interpolation requires GetTypeAtLocation to
// establish redundant wrapping. The rule also handles literal forms without
// a checker; this entry owns the identifier route through the shared
// `seedLintProject` shape established by `restrict-template-expressions` and
// `no-base-to-string`: materialize a tsconfig project, run `ttsc lint check`, and
// assert on the rendered diagnostics.
//
//  1. Seed a project whose “ `${label}` “ template wraps a single
//     string-typed value with empty surrounding chars.
//  2. Run `check` with typescript/no-unnecessary-template-expression
//     enabled as error.
//  3. Assert the command exits non-zero and stderr mentions the rule.
//
// @evidence contracts/testing.md#behavioral-verification A template containing only a string interpolation must report redundant wrapping.
// @evidence contracts/testing.md#independent-expectations The authored original source requires exactly one typescript/no-unnecessary-template-expression rendered error at line 2, exit code 2 and empty stdout; an independently authored clean source requires code 0 and no rule findings.
// @evidence contracts/testing.md#distinguishing-cases The direct string value removes the template wrapper and stays clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusNoUnnecessaryTemplateExpression runs the real Program/Checker via the in-process check command and shared typed semantic oracles; fixture project files configure the operation without installing, building a native artifact or spawning a compiler.
func TestRuleCorpusNoUnnecessaryTemplateExpression(t *testing.T) {
  root := seedLintProject(t, `declare const label: string;
const s = `+"`${label}`"+`;
JSON.stringify({ s });
`)
  seedLintRules(t, root, map[string]string{"typescript/no-unnecessary-template-expression": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "[typescript/no-unnecessary-template-expression]") {
    t.Fatalf("no-unnecessary-template-expression diagnostic mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, "typescript/no-unnecessary-template-expression", stderr, 2)
  assertTypedRuleCleanSource(t, "typescript/no-unnecessary-template-expression", "declare const label: string;\nconst s = label;\nJSON.stringify(s);\n")
}
