package linthost

import "testing"

// TestNoUselessEscapeJudgesQuotesAndTemplateEscapesByEnclosingDelimiter
// verifies that a quote escape is redundant unless it names the enclosing
// delimiter, and that template escapes of `$` and `{` are judged by what follows
// and precedes them.
//
// A backslash before the other quote kind adds nothing in a string, a backslash
// before either quote adds nothing in a template, `\$` matters only before `{`
// and `\{` only after `$`. `\U` has no standard named-escape meaning.
//
//  1. Run the rule over escapes that are required and assert nothing is reported.
//  2. Run it over a single-quoted string escaping a double quote, a double-quoted
//     string escaping a single quote, a template escaping either quote, a lone
//     `\$`, a `\{` after a letter and a `\U`, and assert each exact backslash range.
//
// @evidence contracts/testing.md#behavioral-verification no-useless-escape must accept the enclosing quote, `\${`, `$\{` and a line continuation escape and must report the other quote kind, template quotes, a bare `\$`, a `\{` not after `$` and `\U`.
// @evidence contracts/testing.md#independent-expectations Authored delimiter, interpolation, line-continuation and Unicode escapes remain meaningful. Literal backslash offsets independently locate every redundant quote, neighbor and uppercase-U escape; no expected range is taken from findings.
// @evidence contracts/testing.md#distinguishing-cases Required quote/backtick and interpolation controls stay clean while other quote and neighbor forms report; escaped newline and lowercase-u controls distinguish the uppercase-U report from blanket rejection of escapes.
// @evidence contracts/testing.md#execution-ownership TestNoUselessEscapeJudgesQuotesAndTemplateEscapesByEnclosingDelimiter writes each source to a temporary project, parses it and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestNoUselessEscapeJudgesQuotesAndTemplateEscapesByEnclosingDelimiter(t *testing.T) {
  for _, source := range []string{
    "const a = \"say \\\"hi\\\"\";\nconst b = 'it\\'s';\nconst c = `tick \\` end`;\nconst d = `\\${k}`;\nconst e = `$\\{k}`;\nJSON.stringify([a, b, c, d, e]);\n",
    "const continued = \"before\\\nafter\";\nconst unicode = \"\\u0041\";\nJSON.stringify([continued, unicode]);\n",
  } {
    assertRuleSkipsSource(t, "no-useless-escape", source)
  }
  cases := []struct {
    source string
    want   []int
  }{
    {"const a = 'say \\\"hi\\\"';\nJSON.stringify(a);\n", []int{15, 19}},
    {"const a = \"it\\'s\";\nJSON.stringify(a);\n", []int{13}},
    {"const a = `it\\'s`;\nJSON.stringify(a);\n", []int{13}},
    {"const a = `say \\\"hi\\\"`;\nJSON.stringify(a);\n", []int{15, 19}},
    {"const a = `cost \\$5`;\nJSON.stringify(a);\n", []int{16}},
    {"const a = `a\\{b`;\nJSON.stringify(a);\n", []int{12}},
    {"const a = \"\\U\";\nJSON.stringify(a);\n", []int{11}},
  }
  for _, c := range cases {
    source := c.source
    _, _, findings := runRuleFindingsSnapshot(t, "no-useless-escape", source, nil)
    if len(findings) == 0 {
      t.Fatalf("no-useless-escape on %q: want a finding, got none", source)
    }
    if len(findings) != len(c.want) {
      t.Fatalf("no-useless-escape on %q: want %d findings, got %+v", source, len(c.want), findings)
    }
    for i, pos := range c.want {
      finding := findings[i]
      if finding.Rule != "no-useless-escape" || finding.Severity != SeverityError || finding.Pos != pos || finding.End != pos+1 {
        t.Fatalf("no-useless-escape on %q [%d]: want rule/error range [%d,%d), got %+v", source, i, pos, pos+1, finding)
      }
    }
  }
}
