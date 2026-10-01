package linthost

import (
  "regexp"
  "testing"
)

// TestLintCorpusExpectationParserRejectsMalformedOrTargetlessMarkers verifies
// that a marker-shaped line either parses and reaches a target or fails.
//
// If a parser miss meant "not a fixture", one typo would remove coverage.
// Every line that looks like an expectation marker must therefore be an error
// naming its line, even after valid markers, and a valid marker with no line
// after it has nothing to annotate.
//
// 1. Parse malformed line, JSX-block and mixed marker stacks.
// 2. Parse valid markers at end of file with no following source line.
// 3. Assert each invalid form reports its line and category.
//
// @evidence contracts/testing.md#behavioral-verification corpusParseExpectations is called on authored malformed sources and must return an error naming the offending marker line; the same parser accepts the valid markers in the neighboring case.
// @evidence contracts/testing.md#independent-expectations The marker grammar (`// expect: <rule> <error|warn>` and its JSX block form, with a target line below) is the specification; the expected line numbers are counted from the authored strings.
// @evidence contracts/testing.md#distinguishing-cases An unknown severity, a space before the colon, a missing colon, a missing severity, trailing text and a broken JSX terminator each fail on their own line, including after a valid marker; end-of-file markers fail as targetless.
// @evidence contracts/testing.md#execution-ownership TestLintCorpusExpectationParserRejectsMalformedOrTargetlessMarkers is a discoverable Go unit entry; each row is a named subtest calling the pure parser on an in-memory string.
func TestLintCorpusExpectationParserRejectsMalformedOrTargetlessMarkers(t *testing.T) {
  for _, row := range []struct{ name, source, pattern string }{
    {"unknown-severity", "// expect: rule/name fatal\nconst x = 1;", `malformed.*line 1`},
    {"space-before-colon", "// expect : rule/name error\nconst x = 1;", `malformed.*line 1`},
    {"missing-colon-after-valid", "// expect: first/rule error\nconst first = 1;\n// expect second/rule warn\nconst second = 2;", `malformed.*line 3`},
    {"missing-severity", "// expect: first/rule error\nconst first = 1;\n// expect second/rule\nconst second = 2;", `malformed.*line 3`},
    {"trailing-text", "// expect: first/rule error\nconst first = 1;\n// expect second/rule warn trailing\nconst second = 2;", `malformed.*line 3`},
    {"jsx-unterminated", "{/* expect: rule/name error */\nconst x = 1;", `malformed.*line 1`},
    {"jsx-space-before-colon", "{ /* expect : rule/name error */ }\nconst x = 1;", `malformed.*line 1`},
    {"jsx-missing-colon", "{ /* expect: first/rule error */ }\n<div />\n{ /* expect second/rule warn */ }\n<span />", `malformed.*line 3`},
    {"jsx-missing-severity", "{ /* expect: first/rule error */ }\n<div />\n{ /* expect second/rule */ }\n<span />", `malformed.*line 3`},
    {"mixed-stack", "// expect: first/rule error\n{ /* expect: second/rule fatal */ }\nconst x = 1;", `malformed.*line 2`},
    {"line-targetless", "const x = 1;\n// expect: rule/name error", `line 2.*no following target`},
    {"jsx-targetless", "const x = 1;\n{/* expect: rule/name warn */}", `line 2.*no following target`},
  } {
    t.Run(row.name, func(t *testing.T) {
      _, err := corpusParseExpectations(row.source)
      if err == nil || !regexp.MustCompile(row.pattern).MatchString(err.Error()) {
        t.Fatalf("want error matching %q, got %v", row.pattern, err)
      }
    })
  }
}
