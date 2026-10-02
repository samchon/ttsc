package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAdjustSourceMapForPreambleStripsSourcesContentWithoutMappings Verifies the
// embedded source is corrected even when there are no mappings to shift.
//
// A comment-only or empty source file produces a map with empty `mappings`, so
// the mapping shift is a no-op. but under `inlineSources` its `sourcesContent`
// still carries the injected preamble. The correction must strip sourcesContent
// independently of whether mappings changed, or a banner build of such a file
// would embed the banner-shifted source. (This sealed a real gap: the earlier
// version early-returned when no mapping changed and never reached the strip.)
//
//  1. Build a map with empty mappings and a sourcesContent that is preamble +
//     one comment line, dropLines 3.
//  2. Run AdjustSourceMapForPreamble.
//  3. Assert it reports a change and the embedded source lost its preamble.
//
// @evidence contracts/testing.md#behavioral-verification AdjustSourceMapForPreamble strips three preamble lines and reports change despite empty mappings.
// @evidence contracts/testing.md#independent-expectations The authored comment tail is the exact expected embedded source independently of mapping logic.
// @evidence contracts/testing.md#distinguishing-cases Empty mappings with nonempty source content contrasts with mapping-segment corrections.
// @evidence contracts/testing.md#execution-ownership Go unit TestAdjustSourceMapForPreambleStripsSourcesContentWithoutMappings is discovered by go test in test/driver and invokes source/shim operations directly. Temporary filesystem inputs do not install a consumer or build a host artifact.
func TestAdjustSourceMapForPreambleStripsSourcesContentWithoutMappings(t *testing.T) {
  const dropLines = 3
  doc := map[string]any{
    "version":        3,
    "file":           "out.js",
    "sources":        []string{"src/a.ts"},
    "sourcesContent": []string{"// p1\n// p2\n// p3\n// only a comment\n"},
    "names":          []string{},
    "mappings":       "", // comment-only file: nothing to map
  }
  raw, err := json.Marshal(doc)
  if err != nil {
    t.Fatal(err)
  }

  out, ok := driver.AdjustSourceMapForPreamble(string(raw), dropLines)
  if !ok {
    t.Fatal("expected a change: sourcesContent must be stripped even with empty mappings")
  }
  var parsed struct {
    SourcesContent []string `json:"sourcesContent"`
  }
  if err := json.Unmarshal([]byte(out), &parsed); err != nil {
    t.Fatalf("adjusted map is not valid JSON: %v", err)
  }
  if parsed.SourcesContent[0] != "// only a comment\n" {
    t.Fatalf("preamble not stripped from sourcesContent: %q", parsed.SourcesContent[0])
  }
  if strings.Contains(parsed.SourcesContent[0], "p1") {
    t.Fatalf("sourcesContent still contains preamble lines: %q", parsed.SourcesContent[0])
  }
}
