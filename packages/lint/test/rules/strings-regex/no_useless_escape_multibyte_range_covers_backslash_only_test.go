package linthost

import (
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoUselessEscapeMultibyteRangeCoversBackslashOnly verifies the reported
// range and the fix channel of a multi-byte no-useless-escape finding.
//
// The message for a multi-byte escape is built by decoding the rune that
// follows the backslash, but the finding itself must keep addressing bytes:
// ESLint canonical reports `[rangeStart, rangeStart + 1]` — the backslash
// alone — and the autofix deletes exactly that one byte. This pins the two
// invariants a rune-aware message could plausibly break: the range must not
// widen to the rune's byte length, and the multi-byte arm must stay
// detection-only (deleting the backslash is safe, but the rule declines the
// fix, so an accidental fix would be a behavior change, not a message change).
//
//  1. Lint a string and a regex that uselessly escape a 3-byte rune, plus an
//     ASCII escape as the twin that does carry a fix.
//  2. Assert every finding spans exactly the backslash byte.
//  3. Assert the multi-byte findings carry no fix and the ASCII one deletes
//     exactly the backslash.
func TestNoUselessEscapeMultibyteRangeCoversBackslashOnly(t *testing.T) {
  source := `const wide = "\你";
const pattern = /\你/;
const ascii = "\a";
JSON.stringify([wide, pattern, ascii]);
`
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{
    "no-useless-escape": SeverityError,
  }).Run([]*shimast.SourceFile{file}, nil)
  sort.Slice(findings, func(i, j int) bool { return findings[i].Pos < findings[j].Pos })
  if len(findings) != 3 {
    t.Fatalf("want 3 findings, got %d (%+v)", len(findings), findings)
  }
  wanted := []int{
    strings.Index(source, "\\你"),
    strings.LastIndex(source, "\\你"),
    strings.Index(source, "\\a"),
  }
  for i, pos := range wanted {
    if pos < 0 {
      t.Fatalf("[%d]: fixture lost its escape", i)
    }
    if findings[i].Pos != pos || findings[i].End != pos+1 {
      t.Fatalf("[%d]: want range [%d,%d), got [%d,%d)",
        i, pos, pos+1, findings[i].Pos, findings[i].End)
    }
  }
  for i := 0; i < 2; i++ {
    if len(findings[i].Fix) != 0 {
      t.Fatalf("[%d]: multi-byte escape must stay detection-only, got %+v", i, findings[i].Fix)
    }
  }
  fix := findings[2].Fix
  if len(fix) != 1 || fix[0].Pos != wanted[2] || fix[0].End != wanted[2]+1 || fix[0].Text != "" {
    t.Fatalf("ascii fix mismatch: want one deletion of [%d,%d), got %+v",
      wanted[2], wanted[2]+1, fix)
  }
}
