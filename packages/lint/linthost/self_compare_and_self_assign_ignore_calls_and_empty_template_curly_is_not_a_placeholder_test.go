package linthost

import "testing"

// TestSelfCompareAndSelfAssignIgnoreCallsAndEmptyTemplateCurlyIsNotAPlaceholder
// verifies the reference rules treat a call as unequal to itself and that
// `${}` is not a template placeholder.
//
// Evaluating a call twice can give different values, so `f() === f()` and
// `a.b() = ...` shaped comparisons are not self-references. Plain references,
// member chains and equal literals still are. A `${}` with nothing inside is not
// a placeholder a template literal would interpolate.
//
//  1. Run no-self-compare over a call compared with itself and assert nothing is
//     reported, then over an identifier, a member chain and a literal compared
//     with themselves and assert each reports once.
//  2. Run no-self-assign over `x = x` and `a.b = a.b` and assert each reports, and
//     over `f().b = f().b` and assert nothing is reported.
//  3. Run no-template-curly-in-string over `"${}"` and `"${a}"` and assert only the
//     second reports.
//
// @evidence contracts/testing.md#behavioral-verification no-self-compare and no-self-assign must report identical reference chains and literals and must stay silent for calls, and no-template-curly-in-string must require a non-empty body.
// @evidence contracts/testing.md#independent-expectations ESLint compares operands as references, which never include calls, and its placeholder pattern needs at least one character between the braces; the literal sources are authored from those definitions.
// @evidence contracts/testing.md#distinguishing-cases Each reported shape has a silent twin that differs in one property, a call in place of a reference or an empty body in place of a name, so neither a purely textual comparison nor a bare brace search passes.
// @evidence contracts/testing.md#execution-ownership TestSelfCompareAndSelfAssignIgnoreCallsAndEmptyTemplateCurlyIsNotAPlaceholder parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestSelfCompareAndSelfAssignIgnoreCallsAndEmptyTemplateCurlyIsNotAPlaceholder(t *testing.T) {
  assertRuleSkipsSource(t, "no-self-compare", "function f(): number { return Math.random(); }\nJSON.stringify(f() === f());\n")
  for _, source := range []string{
    "function g(x: number): boolean { return x === x; }\nJSON.stringify(g);\n",
    "function g(o: { a: { b: number } }): boolean { return o.a.b === o.a.b; }\nJSON.stringify(g);\n",
    "JSON.stringify(1 === 1);\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, "no-self-compare", source, nil)
    if len(findings) != 1 {
      t.Fatalf("no-self-compare on %q: want exactly one finding, got %d", source, len(findings))
    }
  }
  for _, source := range []string{
    "let x = 1;\nx = x;\nJSON.stringify(x);\n",
    "const a = { b: 1 };\na.b = a.b;\nJSON.stringify(a);\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, "no-self-assign", source, nil)
    if len(findings) != 1 {
      t.Fatalf("no-self-assign on %q: want exactly one finding, got %d", source, len(findings))
    }
  }
  assertRuleSkipsSource(t, "no-self-assign", "function f(): { b: number } { return { b: 1 }; }\nf().b = f().b;\n")
  assertRuleSkipsSource(t, "no-template-curly-in-string", "const s = \"${}\";\nJSON.stringify(s);\n")
  assertRuleFindingRanges(t, "no-template-curly-in-string", "const s = \"${a}\";\nJSON.stringify(s);\n", "\"${a}\"")
}
