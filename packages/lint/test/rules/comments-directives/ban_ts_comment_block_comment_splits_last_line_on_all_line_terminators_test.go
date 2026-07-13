package linthost

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentBlockCommentSplitsLastLineOnAllLineTerminators verifies
// typescript/ban-ts-comment's block-comment line splitting covers every
// ECMAScript line terminator.
//
// Upstream splits block-comment values with LINEBREAK_MATCHER
// (`\r\n`, `\r`, `\n`, U+2028, U+2029). A splitter that only understood
// `\n` would treat "not on the last line\r * @ts-expect-error" as one line
// and miss the directive, so each terminator is pinned with an invalid
// upstream case.
//
//  1. Lint block comments whose last line (per each terminator) carries the
//     directive, configured `ts-expect-error: true`.
//  2. Assert exactly one finding per source.
func TestBanTsCommentBlockCommentSplitsLastLineOnAllLineTerminators(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  for _, source := range []string{
    "/* not on the last line\r\n * @ts-expect-error */\nconst a = 1;\nJSON.stringify(a);\n",
    "/* not on the last line\r * @ts-expect-error */\nconst a = 1;\nJSON.stringify(a);\n",
    "/* not on the last line\n * @ts-expect-error */\nconst a = 1;\nJSON.stringify(a);\n",
    "/* not on the last line\u2028 * @ts-expect-error */\nconst a = 1;\nJSON.stringify(a);\n",
    "/* not on the last line\u2029 * @ts-expect-error */\nconst a = 1;\nJSON.stringify(a);\n",
  } {
    file := parseTS(t, source)
    resolver := InlineRuleResolver{
      Rules:   RuleConfig{ruleName: SeverityError},
      Options: RuleOptionsMap{ruleName: json.RawMessage(`{"ts-expect-error": true}`)},
    }
    findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil)
    if len(findings) != 1 {
      t.Fatalf("%q: want 1 finding, got %d (%+v)", source, len(findings), findings)
    }
  }
}
