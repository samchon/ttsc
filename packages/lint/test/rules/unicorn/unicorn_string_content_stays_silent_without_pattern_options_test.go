package linthost

import "testing"

// TestUnicornStringContentStaysSilentWithoutPatternOptions verifies the rule
// reports nothing when no replacement pattern is configured.
//
// Upstream ships no default patterns and returns before registering any
// listener when `patterns` is empty. The stub this rule replaced was silent
// for the wrong reason; this pins the silence as the CONTRACT for a bare
// severity, an empty options object, an empty patterns map, and a
// selectors-only configuration.
//
//  1. Lint a source full of string literals and template quasis.
//  2. Run it under a bare severity and each empty-option shape.
//  3. Assert zero findings for every configuration.
func TestUnicornStringContentStaysSilentWithoutPatternOptions(t *testing.T) {
  source := "const foo = 'no';\nconst bar = `no${foo}no`;\n"
  assertRuleSkipsSource(t, "unicorn/string-content", source)
  for name, options := range map[string]string{
    "empty object":   `{}`,
    "empty patterns": `{"patterns":{}}`,
    "selectors only": `{"selectors":["Literal"]}`,
  } {
    t.Run(name, func(t *testing.T) {
      assertRuleSkipsSourceWithOptions(t, "unicorn/string-content", source, options)
    })
  }
}
