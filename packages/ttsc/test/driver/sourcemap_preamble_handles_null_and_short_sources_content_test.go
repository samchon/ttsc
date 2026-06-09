package driver_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAdjustSourceMapForPreambleHandlesNullAndShortSourcesContent verifies the
// two defensive branches of the sourcesContent stripper: a null entry and an
// entry with fewer than dropLines lines are both left alone (no panic).
//
// tsgo emits `null` in sourcesContent for a source it could not read, and the
// `len(parts) <= dropLines` guard protects against a content shorter than the
// preamble. Dropping either guard would panic (nil deref / index out of range)
// on real input. The happy-path stripper test uses only a normal long string,
// so these branches were unexercised.
//
//  1. Build a map with three preamble-target sources whose sourcesContent is
//     [null, a 2-line string, a long strippable string], dropLines 3.
//  2. Run AdjustSourceMapForPreamble.
//  3. Assert no panic, the null stays null, the short string is untouched, and
//     the long string is stripped.
func TestAdjustSourceMapForPreambleHandlesNullAndShortSourcesContent(t *testing.T) {
  const dropLines = 3
  doc := map[string]any{
    "version":        3,
    "file":           "out.js",
    "sources":        []string{"a.ts", "b.ts", "c.ts"},
    "sourcesContent": []any{nil, "x\ny\n", "p1\np2\np3\nreal();\n"},
    "names":          []string{},
    "mappings": buildMappings([]absSeg{
      {genLine: 0, genCol: 0, srcIdx: 2, srcLine: 5, srcCol: 0},
    }),
  }
  raw, err := json.Marshal(doc)
  if err != nil {
    t.Fatal(err)
  }

  out, ok := driver.AdjustSourceMapForPreamble(string(raw), dropLines)
  if !ok {
    t.Fatal("expected the map to change")
  }
  var parsed struct {
    SourcesContent []*string `json:"sourcesContent"`
  }
  if err := json.Unmarshal([]byte(out), &parsed); err != nil {
    t.Fatalf("adjusted map is not valid JSON: %v", err)
  }
  if len(parsed.SourcesContent) != 3 {
    t.Fatalf("expected three sourcesContent entries, got %d", len(parsed.SourcesContent))
  }
  if parsed.SourcesContent[0] != nil {
    t.Fatalf("null entry must stay null, got %q", *parsed.SourcesContent[0])
  }
  if parsed.SourcesContent[1] == nil || *parsed.SourcesContent[1] != "x\ny\n" {
    t.Fatalf("short (< dropLines) content must be left unchanged, got %v", parsed.SourcesContent[1])
  }
  if parsed.SourcesContent[2] == nil || *parsed.SourcesContent[2] != "real();\n" {
    t.Fatalf("long content must be stripped to %q, got %v", "real();\n", parsed.SourcesContent[2])
  }
}
