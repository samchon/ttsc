package linthost

import (
  "sort"
  "strings"
  "testing"
)

// TestRuleCorpusUnicornNoTypeofUndefined verifies every upstream-invalid
// `typeof <local> <op> "undefined"` comparison reports at the `typeof` keyword,
// with the upstream message and an attached autofix.
//
// Upstream matches only when the `typeof` is the left operand of an equality
// comparison whose right side is the string literal `"undefined"`, and skips
// globals by default because rewriting them can throw. Pinning all four
// equality operators over a `let`, a `const`, a `var`, and a member-access
// operand locks the checker-backed "has a local binding" branch (a name-only
// match would collude with the skipped global forms) and the diagnostic range,
// which upstream anchors to the `typeof` keyword rather than the whole
// comparison. The negative twin — every upstream-valid shape — lives in the
// skips-upstream-valid-forms case.
//
//  1. Enable unicorn/no-typeof-undefined on one source stacking the reporting
//     shapes, each operand a binding declared in the same file.
//  2. Run the checker-backed snapshot path.
//  3. Assert one finding per `typeof`, at the keyword range, with the message,
//     a non-empty fix, and no suggestion.
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
