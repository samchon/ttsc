package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAdjustSourceMapForPreambleKeepsHtmlCharsInSourcesContent Verifies the
// corrected map does not HTML-escape `<`, `>`, `&` in embedded source text.
//
// Go's default json.Marshal encodes those bytes as Unicode escapes;
// TypeScript-Go's serializer leaves them literal. Re-encoding the map
// with the default would byte-diverge from tsgo's native maps for any source
// containing generics, JSX, or `&&`/`&`, valid JSON, but needless churn. The
// encoder must therefore run with HTML escaping disabled; this pins it.
//
//  1. Build an inlineSources map whose sourcesContent holds `Array<number>` and
//     `a && b`, with a 1-line preamble.
//  2. Run AdjustSourceMapForPreamble.
//  3. Require literal HTML characters and reject their JSON Unicode escapes.
//
// @evidence contracts/testing.md#behavioral-verification AdjustSourceMapForPreamble retains literal Array<number> and a && b and excludes escaped less-than, greater-than and ampersand JSON sequences.
// @evidence contracts/testing.md#independent-expectations TypeScript-Go source-map serialization preserves these source bytes literally; the authored string and explicit forbidden encodings establish the expected representation.
// @evidence contracts/testing.md#distinguishing-cases One inlineSources entry with generics and boolean operators owns HTML escaping during a changed map; null and short contents are separate cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver constructs a small source-map input and directly calls correction without running a compiler or banner host.
func TestAdjustSourceMapForPreambleKeepsHtmlCharsInSourcesContent(t *testing.T) {
  const dropLines = 1
  content := "// banner\nconst x: Array<number> = []; if (a && b) {}\n"
  doc := map[string]any{
    "version":        3,
    "file":           "out.js",
    "sources":        []string{"src/a.ts"},
    "sourcesContent": []string{content},
    "names":          []string{},
    "mappings": buildMappings([]absSeg{
      {genLine: 0, genCol: 0, srcIdx: 0, srcLine: 2, srcCol: 0},
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
  if !strings.Contains(out, "Array<number>") || !strings.Contains(out, "a && b") {
    t.Fatalf("HTML chars were escaped in sourcesContent:\n%s", out)
  }
  for _, escaped := range []string{"\\u003c", "\\u003e", "\\u0026"} {
    if strings.Contains(out, escaped) {
      t.Fatalf("sourcesContent contains escaped HTML entity %q:\n%s", escaped, out)
    }
  }
}
