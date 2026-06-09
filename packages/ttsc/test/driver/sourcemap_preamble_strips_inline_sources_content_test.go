package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAdjustSourceMapForPreambleStripsInlineSourcesContent verifies that, under
// `inlineSources`, the embedded source text is corrected together with the
// mappings.
//
// `inlineSources` embeds the parsed source into `sourcesContent`, and that text
// is the preamble-injected source. If only `mappings` were corrected, the
// embedded text would still carry the banner and every line would be off by the
// preamble's line count — a debugger using sourcesContent would jump wrong. This
// pins that the leading preamble lines are stripped from preamble-injected
// sources (and that non-preamble sources are left intact).
//
//  1. Build a map with sourcesContent for a `.ts` (preamble-injected) and a
//     `.json` (not) source, mappings shifted by a 3-line preamble.
//  2. Run AdjustSourceMapForPreamble.
//  3. Assert the `.ts` content lost its 3 banner lines, the `.json` content is
//     untouched, and the mapping shifted to source line 2.
func TestAdjustSourceMapForPreambleStripsInlineSourcesContent(t *testing.T) {
  const dropLines = 3
  tsContent := "// banner 1\n// banner 2\n// banner 3\nexport const a = 0;\n"
  jsonContent := "{\n  \"k\": 1\n}\n"
  doc := map[string]any{
    "version":        3,
    "file":           "out.js",
    "sources":        []string{"src/a.ts", "data/b.json"},
    "sourcesContent": []string{tsContent, jsonContent},
    "names":          []string{},
    "mappings": buildMappings([]absSeg{
      {genLine: 0, genCol: 0, srcIdx: 0, srcLine: 5, srcCol: 0}, // a.ts -> 2
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
    SourcesContent []string `json:"sourcesContent"`
    Mappings       string   `json:"mappings"`
  }
  if err := json.Unmarshal([]byte(out), &parsed); err != nil {
    t.Fatalf("adjusted map is not valid JSON: %v", err)
  }
  if len(parsed.SourcesContent) != 2 {
    t.Fatalf("expected two sourcesContent entries, got %d", len(parsed.SourcesContent))
  }
  if parsed.SourcesContent[0] != "export const a = 0;\n" {
    t.Fatalf("preamble not stripped from .ts sourcesContent: %q", parsed.SourcesContent[0])
  }
  if strings.Contains(parsed.SourcesContent[0], "banner") {
    t.Fatalf(".ts sourcesContent still contains banner lines: %q", parsed.SourcesContent[0])
  }
  if parsed.SourcesContent[1] != jsonContent {
    t.Fatalf(".json sourcesContent must be untouched, got %q", parsed.SourcesContent[1])
  }
  if segs := parseMappings(parsed.Mappings); len(segs) != 1 || segs[0].srcLine != 2 {
    t.Fatalf("mapping not shifted to source line 2: %#v", segs)
  }
}
