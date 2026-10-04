package linthost

import (
  "sort"
  "strings"
  "testing"
)

// TestRuleCorpusUnicornNoTypeofUndefined verifies the authored
// `typeof <local> <op> "undefined"` comparison reports at the `typeof` keyword,
// with the literal message and a non-empty autofix.
//
// The owning rule matches only when the `typeof` is the left operand of an equality
// comparison whose right side is the string literal `"undefined"`, and skips
// globals by default because rewriting them can throw. Pinning all four
// equality operators over a `let`, a `const`, a `var`, and a member-access
// operand locks the checker-backed "has a local binding" branch (a name-only
// match would collude with the skipped global forms) and the diagnostic range,
// which the rule anchors to the `typeof` keyword rather than the whole
// comparison. This entry checks these four reporting forms, not the exact
// autofix edits or their application.
//
//  1. Enable unicorn/no-typeof-undefined on one source stacking the reporting
//     shapes, each operand a binding declared in the same file.
//  2. Run the checker-backed snapshot path.
//  3. Assert one finding per `typeof`, at the keyword range, with the message,
//     a non-empty fix, and no suggestion.
//
// @evidence contracts/testing.md#behavioral-verification four local comparisons report exactly at each typeof keyword with exact message, severity, an automatic fix and no suggestions.
// @evidence contracts/testing.md#independent-expectations Authored keyword occurrences and literal diagnostic message derive expected ranges/text independently of the product visitor.
// @evidence contracts/testing.md#distinguishing-cases Let/const/var/member operands cover all four equality operators in this local reporting matrix.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornNoTypeofUndefined is a discoverable Go unit host; owning checker-backed engine operations run its literal fixtures in the shared process without installation, native builds or product children. Indexed failures retain each independently authored keyword range and literal diagnostic identity.
func TestRuleCorpusUnicornNoTypeofUndefined(t *testing.T) {
  const ruleName = "unicorn/no-typeof-undefined"
  source := `declare const object: { property: unknown };
let mutableBinding: unknown;
const constantBinding: unknown = object;
var hoistedBinding: unknown;

typeof mutableBinding === "undefined";
typeof constantBinding !== "undefined";
typeof hoistedBinding == "undefined";
typeof object.property != "undefined";
`
  const keyword = "typeof"
  starts := make([]int, 0)
  for offset := 0; ; {
    index := strings.Index(source[offset:], keyword+" ")
    if index < 0 {
      break
    }
    starts = append(starts, offset+index)
    offset = offset + index + len(keyword)
  }
  if len(starts) != 4 {
    t.Fatalf("test wiring: expected 4 typeof operands, found %d", len(starts))
  }

  _, _, findings := runRuleFindingsSnapshot(t, ruleName, source, nil)
  if len(findings) != len(starts) {
    t.Fatalf("expected %d findings, got %d: %+v", len(starts), len(findings), findings)
  }
  sort.Slice(findings, func(i, j int) bool { return findings[i].Pos < findings[j].Pos })

  const message = "Compare with `undefined` directly instead of using `typeof`."
  for index, finding := range findings {
    start := starts[index]
    if finding.Rule != ruleName || finding.Severity != SeverityError {
      t.Fatalf("finding %d identity mismatch: %+v", index, finding)
    }
    if finding.Pos != start || finding.End != start+len(keyword) {
      t.Fatalf(
        "finding %d range: got=[%d,%d) want=[%d,%d) (%q)",
        index, finding.Pos, finding.End, start, start+len(keyword),
        source[start:start+len(keyword)],
      )
    }
    if finding.Message != message {
      t.Fatalf("finding %d message: got %q want %q", index, finding.Message, message)
    }
    if len(finding.Fix) == 0 {
      t.Fatalf("finding %d must carry an autofix", index)
    }
    if len(finding.Suggestions) != 0 {
      t.Fatalf("finding %d must not carry suggestions: %+v", index, finding.Suggestions)
    }
  }
}
