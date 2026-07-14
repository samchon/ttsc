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
