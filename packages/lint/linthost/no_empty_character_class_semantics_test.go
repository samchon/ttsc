package linthost

import (
  "reflect"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoEmptyCharacterClassUsesParsedClassSemantics keeps the core and regexp
// rule ids on one canonical predicate. It covers legacy, Unicode, Unicode Sets,
// nested class-set, escaped delimiter, range, negation, and invalid-syntax
// boundaries through the public engine surface.
//
// @evidence contracts/testing.md#behavioral-verification Both bare and namespaced rules report only four syntactically valid empty classes.
// @evidence contracts/testing.md#independent-expectations Authored lines 1,5,7,9 follow ECMAScript legacy/u/v class meaning; negated classes match characters and malformed regexes must not receive this valid-class diagnostic.
// @evidence contracts/testing.md#distinguishing-cases Twenty regexes distinguish empty/negated/nested sets, brackets/ranges, conflicting/unknown/duplicate flags and invalid escapes.
// @evidence contracts/testing.md#execution-ownership parseTS constructs the twenty authored regex literals and NewEngine.Run executes both selected rule names. This Test groups normalizeRuleFindings by rule and compares each complete line list with literal [1,5,7,9]. The calls remain in the lint Go process without consumer installation or a native product-host build/launch.
func TestNoEmptyCharacterClassUsesParsedClassSemantics(t *testing.T) {
  file := parseTS(t, `const legacyEmpty = /[]/;
const legacyNegated = /[^]/;
const escapedBrackets = /[\[\]]/;
const range = /[a-z]/;
const unicodeEmpty = /[]/u;
const unicodeNegated = /[^]/u;
const setsEmpty = /[]/v;
const setsNegated = /[^]/v;
const nestedSetsEmpty = /[[]]/v;
const nestedSetsNegated = /[[^]]/v;
const nestedSetsRange = /[[a-z]&&[a-m]]/v;
const invalidFlags = /[]/uv;
const invalidNestedSet = /[[]&&]/v;
const legacyLiteralOpen = /[[]/;
const unicodeEscapedClose = /[\]]/u;
const setsEscapedBrackets = /[\[\]]/v;
const nestedSetsNonEmpty = /[[a-z]]/v;
const invalidEscape = /\u{110000}[]/u;
const unknownFlag = /[]/z;
const duplicateFlag = /[]/uu;
`)
  findings := NewEngine(RuleConfig{
    "no-empty-character-class":        SeverityError,
    "regexp/no-empty-character-class": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)

  lines := map[string][]int{}
  for _, finding := range normalizeRuleFindings(file, findings) {
    lines[finding.Rule] = append(lines[finding.Rule], finding.Line)
  }
  want := []int{1, 5, 7, 9}
  for _, rule := range []string{"no-empty-character-class", "regexp/no-empty-character-class"} {
    if !reflect.DeepEqual(lines[rule], want) {
      t.Fatalf("%s lines = %v, want %v; all=%v", rule, lines[rule], want, lines)
    }
  }
}
