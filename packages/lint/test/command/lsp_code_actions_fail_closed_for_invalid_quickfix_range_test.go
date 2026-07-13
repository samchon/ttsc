package linthost

import (
  "path/filepath"
  "testing"
)

// TestLSPCodeActionsFailClosedForInvalidQuickfixRange verifies an editor
// selection is mandatory before the sidecar exposes opt-in source edits.
//
//  1. Pin closed-open overlap behavior at a diagnostic's start and end.
//  2. Seed a file with a valid switch suggestion.
//  3. Request quick fixes with missing, malformed, incomplete, reversed, and
//     non-overlapping ranges, including omitted position fields.
//  4. Require every request to return no actions rather than file-wide edits.
func TestLSPCodeActionsFailClosedForInvalidQuickfixRange(t *testing.T) {
  diagnosticRange := lspRange{
    Start: lspPosition{Line: 2, Character: 3},
    End:   lspPosition{Line: 2, Character: 8},
  }
  for _, tc := range []struct {
    name string
    at   lspPosition
    want bool
  }{
    {name: "start", at: diagnosticRange.Start, want: true},
    {name: "inside", at: lspPosition{Line: 2, Character: 5}, want: true},
    {name: "end", at: diagnosticRange.End, want: false},
  } {
    cursor := lspRange{Start: tc.at, End: tc.at}
    if got := lspRangesOverlap(cursor, diagnosticRange); got != tc.want {
      t.Fatalf("cursor %s overlap: want %v, got %v", tc.name, tc.want, got)
    }
  }

  root := seedLintProject(t, `
declare const value: "left" | "right";
switch (value) { case "left": break; }
`)
  seedLintRules(t, root, map[string]string{switchExhaustivenessCheckRuleName: "error"})
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))
  invalidRanges := []string{
    "",
    `{}`,
    `{broken`,
    `{"start":{"line":1,"character":0}}`,
    `{"start":{},"end":{"line":2,"character":1}}`,
    `{"start":{"line":2},"end":{"line":2,"character":1}}`,
    `{"start":{"line":2,"character":0},"end":{"character":1}}`,
    `{"start":{"line":2,"character":0},"end":{"line":2}}`,
    `{"start":{"line":2,"character":1},"end":{"line":1,"character":0}}`,
  }
  for _, rangeJSON := range invalidRanges {
    if _, ok := parseRequestedLSPRange(rangeJSON); ok {
      t.Fatalf("range %q unexpectedly parsed as valid", rangeJSON)
    }
    actions := runLSPCodeActionsForRangeForTest(
      t,
      root,
      uri,
      rangeJSON,
      `{"only":["quickfix"]}`,
    )
    if len(actions) != 0 {
      t.Fatalf("range %q unexpectedly returned quick fixes: %#v", rangeJSON, actions)
    }
  }

  nonOverlappingRange := `{"start":{"line":0,"character":0},"end":{"line":1,"character":0}}`
  if _, ok := parseRequestedLSPRange(nonOverlappingRange); !ok {
    t.Fatalf("range %q should be structurally valid", nonOverlappingRange)
  }
  actions := runLSPCodeActionsForRangeForTest(
    t,
    root,
    uri,
    nonOverlappingRange,
    `{"only":["quickfix"]}`,
  )
  if len(actions) != 0 {
    t.Fatalf("non-overlapping range unexpectedly returned quick fixes: %#v", actions)
  }
}
