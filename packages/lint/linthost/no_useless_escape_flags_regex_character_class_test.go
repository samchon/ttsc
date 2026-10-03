package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUselessEscapeFlagsRegexCharacterClass verifies no-useless-escape inside `[...]`.
//
// The flagless authored class literals escape dot, dollar and an opening
// parenthesis, which are ordinary members in these classes. The paired
// outside dot, interior dash, closing bracket and word-class escapes
// must remain meaningful. Character-class position and Unicode Sets mode
// have additional escape rules; this finite fixture does not establish
// an exhaustive allowlist for those cases.
//
// 1. Parse regex literals with redundant char-class escapes alongside legitimate ones.
// 2. Enable only `no-useless-escape`.
// 3. Assert each useless-inside-class escape is reported and the legitimate escapes stay silent.
//
// @evidence contracts/testing.md#behavioral-verification Reports redundant class escapes for dot, dollar and paren without reporting meaningful outside-dot, dash, closing-bracket or word escapes.
// @evidence contracts/testing.md#independent-expectations ECMAScript class grammar makes the first three escaped characters ordinary class members; literal line 1/2/3 expectations are independent.
// @evidence contracts/testing.md#distinguishing-cases Inside/outside dot and class syntax/shorthand controls distinguish context-sensitive escape meaning.
// @evidence contracts/testing.md#execution-ownership parseTS constructs the seven authored regex literals and NewEngine.Run executes no-useless-escape. This Test compares every normalized rule/severity/line entry with the literal three-line list. The calls remain in the lint Go process without consumer installation or a native product-host build/launch.
func TestNoUselessEscapeFlagsRegexCharacterClass(t *testing.T) {
  source := `const dotInClass = /[\.]/;
const dollarInClass = /[\$]/;
const parenInClass = /[\(]/;
const literalDot = /\./;
const dashInClass = /[a\-z]/;
const closeBracketInClass = /[\]]/;
const wordInClass = /[\w]/;
`
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{
    "no-useless-escape": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  actual := normalizeRuleFindings(file, findings)
  expected := []ruleExpectation{
    {Rule: "no-useless-escape", Severity: SeverityError, Line: 1},
    {Rule: "no-useless-escape", Severity: SeverityError, Line: 2},
    {Rule: "no-useless-escape", Severity: SeverityError, Line: 3},
  }
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v; all findings=%+v", i, expected[i], actual[i], actual)
    }
  }
}
