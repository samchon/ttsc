package linthost

import "testing"

// TestNoUselessEscapeJudgesQuotesAndTemplateEscapesByEnclosingDelimiter
// verifies that a quote escape is redundant unless it names the enclosing
// delimiter, and that template escapes of `$` and `{` are judged by what follows
// and precedes them.
//
// A backslash before the other quote kind adds nothing in a string, a backslash
// before either quote adds nothing in a template, `\$` matters only before `{`
// and `\{` only after `$`. `\U` is no JavaScript escape at all.
//
//  1. Run the rule over escapes that are required and assert nothing is reported.
//  2. Run it over a single-quoted string escaping a double quote, a double-quoted
//     string escaping a single quote, a template escaping either quote, a lone
//     `\$`, a `\{` after a letter and a `\U`, and assert each reports once.
//
// @evidence contracts/testing.md#behavioral-verification no-useless-escape must accept the enclosing quote, `\${`, `$\{` and a line continuation escape and must report the other quote kind, template quotes, a bare `\$`, a `\{` not after `$` and `\U`.
// @evidence contracts/testing.md#independent-expectations ECMAScript defines which escapes change a string value: only the delimiter, the standard escape letters and line terminators do, and ESLint's rule documents the other quote kind as incorrect; the expectations are authored literals.
// @evidence contracts/testing.md#distinguishing-cases Every reported source has an accepted twin that differs only in which quote or neighbor the backslash sits beside, so a rule that exempted all quotes or all dollar signs fails one side.
// @evidence contracts/testing.md#execution-ownership TestNoUselessEscapeJudgesQuotesAndTemplateEscapesByEnclosingDelimiter parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestNoUselessEscapeJudgesQuotesAndTemplateEscapesByEnclosingDelimiter(t *testing.T) {
  for _, source := range []string{
    "const a = \"say \\\"hi\\\"\";\nconst b = 'it\\'s';\nconst c = `tick \\` end`;\nconst d = `\\${k}`;\nconst e = `$\\{k}`;\nJSON.stringify([a, b, c, d, e]);\n",
  } {
    assertRuleSkipsSource(t, "no-useless-escape", source)
  }
  for _, source := range []string{
    "const a = 'say \\\"hi\\\"';\nJSON.stringify(a);\n",
    "const a = \"it\\'s\";\nJSON.stringify(a);\n",
    "const a = `it\\'s`;\nJSON.stringify(a);\n",
    "const a = `say \\\"hi\\\"`;\nJSON.stringify(a);\n",
    "const a = `cost \\$5`;\nJSON.stringify(a);\n",
    "const a = `a\\{b`;\nJSON.stringify(a);\n",
    "const a = \"\\U\";\nJSON.stringify(a);\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, "no-useless-escape", source, nil)
    if len(findings) == 0 {
      t.Fatalf("no-useless-escape on %q: want a finding, got none", source)
    }
  }
}
