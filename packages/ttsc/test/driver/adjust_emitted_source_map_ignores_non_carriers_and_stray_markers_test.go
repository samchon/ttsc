package driver_test

import (
  "encoding/base64"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAdjustEmittedSourceMapIgnoresNonCarriersAndStrayMarkers verifies the two
// guards that keep inline-map correction from touching the wrong bytes: the
// carrier extension allowlist and the anchored `//# sourceMappingURL=` marker.
//
// AdjustEmittedSourceMap only scans JavaScript/declaration outputs (not
// `.tsbuildinfo` etc.) and only treats a full `//# sourceMappingURL=data:...`
// comment as a trailer. Without those guards a coincidental data-URL line in a
// non-carrier file, or a `data:` literal inside emitted JS, could be decoded and
// rewritten, corrupting the file. These are the negative twins for the inline
// positive case.
//
//  1. Feed a `.tsbuildinfo` whose body contains a real, well-formed inline map
//     trailer.
//  2. Feed a `.js` whose only `data:application/json;base64,` occurrence is
//     inside a string literal (no `//# sourceMappingURL=` trailer).
//  3. Assert both are returned unchanged with ok=false.
func TestAdjustEmittedSourceMapIgnoresNonCarriersAndStrayMarkers(t *testing.T) {
  const dropLines = 3
  mapJSON := makeMapJSON([]string{"src/a.ts"}, buildMappings([]absSeg{
    {genLine: 0, genCol: 0, srcIdx: 0, srcLine: 5, srcCol: 0},
  }))
  trailer := "//# sourceMappingURL=data:application/json;base64," +
    base64.StdEncoding.EncodeToString([]byte(mapJSON))

  // A non-carrier output (.tsbuildinfo) is never scanned, even with a real trailer.
  buildinfo := "{\"version\":\"x\"}\n" + trailer + "\n"
  if out, ok := driver.AdjustEmittedSourceMap("dist/out.tsbuildinfo", buildinfo, dropLines); ok || out != buildinfo {
    t.Fatalf(".tsbuildinfo must not be scanned for an inline map, got ok=%v", ok)
  }

  // A carrier .js whose only data: occurrence is a string literal, with no
  // `//# sourceMappingURL=` comment, must be left untouched.
  strayJS := "const s = \"data:application/json;base64,AAAA\";\nconsole.log(s);\n"
  if out, ok := driver.AdjustEmittedSourceMap("dist/out.js", strayJS, dropLines); ok || out != strayJS {
    t.Fatalf("a stray data: literal must not be treated as a trailer, got ok=%v", ok)
  }
}
