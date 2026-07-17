package linthost

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestLSPDiagnosticTagsDropUnknownValues verifies the wire conversion emits only
// tags the LSP enum defines.
//
// A future rule.DiagnosticTag value would otherwise reach the editor as an
// integer no client understands. Dropping the unknown here keeps a forward
// contributor from shipping a tag that renders as nothing or, worse, as some
// unrelated future LSP tag.
//
//  1. Convert a set mixing known and unknown tag values.
//  2. Assert only the known ones survive, in order.
//  3. Assert an all-unknown set and an empty set both collapse to nil, so the
//     omitempty wire field stays absent rather than an empty array.
func TestLSPDiagnosticTagsDropUnknownValues(t *testing.T) {
  got := lspDiagnosticTags([]rule.DiagnosticTag{
    rule.DiagnosticTagUnnecessary,
    99,
    rule.DiagnosticTagDeprecated,
  })
  if len(got) != 2 || got[0] != 1 || got[1] != 2 {
    t.Fatalf("unknown tag not dropped: %v", got)
  }
  if lspDiagnosticTags(nil) != nil {
    t.Fatal("an empty tag set must convert to nil, not an empty slice")
  }
  if lspDiagnosticTags([]rule.DiagnosticTag{99}) != nil {
    t.Fatal("an all-unknown set must convert to nil rather than an empty slice")
  }
}
