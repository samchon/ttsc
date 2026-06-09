package driver_test

import (
  "encoding/base64"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAdjustEmittedSourceMapDispatchesInlineAndExternal verifies the emitted-file
// dispatcher: external `.map` files are corrected as raw JSON, inline base64 maps
// embedded in a `//# sourceMappingURL=data:...` JS trailer are decoded/corrected/
// re-encoded in place, and files with no map are left untouched.
//
// The preamble shift corrupts inline maps exactly like external ones, but inline
// maps live inside the `.js` text (no `.map` file), so a `.map`-suffix-only check
// would silently skip them. This pins all three shapes.
//
//  1. Build a shifted single-source map (dropLines 3, real code at source line 5).
//  2. Feed it as an external `.map`, as an inline data-URL JS trailer, and as a
//     plain `.js` with no map.
//  3. Assert external + inline both move the real segment to source line 2 and the
//     no-map text is returned unchanged with ok=false.
func TestAdjustEmittedSourceMapDispatchesInlineAndExternal(t *testing.T) {
  const dropLines = 3
  sources := []string{"src/a.ts"}
  mapJSON := makeMapJSON(sources, buildMappings([]absSeg{
    {genLine: 0, genCol: 0, srcIdx: 0, srcLine: 5, srcCol: 0},
  }))

  // External .map: corrected as raw JSON.
  external, ok := driver.AdjustEmittedSourceMap("dist/out.js.map", mapJSON, dropLines)
  if !ok {
    t.Fatal("external .map should be adjusted")
  }
  if got := parseMappings(mappingsOf(external)); len(got) != 1 || got[0].srcLine != 2 {
    t.Fatalf("external: want one segment at source line 2, got %#v", got)
  }

  // Inline base64 map embedded in the JS trailer.
  inlineJS := "\"use strict\";\nconsole.log(1);\n//# sourceMappingURL=data:application/json;base64," +
    base64.StdEncoding.EncodeToString([]byte(mapJSON)) + "\n"
  adjustedJS, ok := driver.AdjustEmittedSourceMap("dist/out.js", inlineJS, dropLines)
  if !ok {
    t.Fatal("inline map JS should be adjusted")
  }
  marker := "base64,"
  start := strings.LastIndex(adjustedJS, marker) + len(marker)
  end := start
  for end < len(adjustedJS) && adjustedJS[end] != '\n' {
    end++
  }
  raw, err := base64.StdEncoding.DecodeString(adjustedJS[start:end])
  if err != nil {
    t.Fatalf("re-encoded inline map is not valid base64: %v", err)
  }
  if got := parseMappings(mappingsOf(string(raw))); len(got) != 1 || got[0].srcLine != 2 {
    t.Fatalf("inline: want one segment at source line 2, got %#v", got)
  }
  // The JS body around the trailer must be preserved.
  if !strings.HasPrefix(adjustedJS, "\"use strict\";\nconsole.log(1);\n") {
    t.Fatalf("inline adjust corrupted the JS body:\n%s", adjustedJS)
  }

  // Plain JS with no source map: untouched.
  plain := "console.log(1);\n"
  if out, ok := driver.AdjustEmittedSourceMap("dist/out.js", plain, dropLines); ok || out != plain {
    t.Fatalf("plain JS must be left unchanged, got ok=%v out=%q", ok, out)
  }

  // No preamble (dropLines <= 0): no-op.
  if out, ok := driver.AdjustEmittedSourceMap("dist/out.js.map", mapJSON, 0); ok || out != mapJSON {
    t.Fatalf("dropLines<=0 must be a no-op, got ok=%v", ok)
  }
}
