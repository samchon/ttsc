package linthost

import (
  "encoding/json"
  "strings"
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
//  2. Assert exactly one ban diagnostic with the full comment range per source.
//
// @evidence contracts/testing.md#behavioral-verification ban-ts-comment recognizes final-line suppression after each ECMAScript line terminator and reports the literal ban message over the entire comment, rather than accepting a rule-failure finding.
// @evidence contracts/testing.md#independent-expectations CRLF, CR, LF, U+2028 and U+2029 each end a source line. The literal true option requires one named error with the authored ban message and byte range from zero through the first closing delimiter; expected fields are not derived from emitted findings.
// @evidence contracts/testing.md#distinguishing-cases Five terminators prevent LF-only last-line scanning; before-last-line placement is separately negative. Exact message/range rejects a single panic or wrong diagnostic in place of a ban.
// @evidence contracts/testing.md#execution-ownership parseTS and NewEngineWithResolver.Run execute the five source variants in this Test loop. No consumer install or native product-host build/launch is used.
func TestBanTsCommentBlockCommentSplitsLastLineOnAllLineTerminators(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  const message = "Do not use `@ts-expect-error` because it alters compilation errors."
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
    finding := findings[0]
    commentEnd := strings.Index(source, "*/") + len("*/")
    if finding == nil || finding.Rule != ruleName || finding.Severity != SeverityError ||
      finding.Message != message || finding.Pos != 0 || finding.End != commentEnd {
      t.Fatalf("%q: want %s error %q in [0,%d), got %+v", source, ruleName, message, commentEnd, finding)
    }
  }
}
