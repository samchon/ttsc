package driver_test

import (
  "encoding/json"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestAdjustSourceMapForPreambleUndoesSourceLineShift verifies that
// AdjustSourceMapForPreamble moves real-code source lines back up by the
// preamble's line count and drops mappings that fell inside the injected
// preamble region.
//
// This pins the @ttsc/banner source-map corruption fix: the banner is injected
// at the source level, so without this rewrite every emitted mapping for real
// code points `dropLines` lines too deep (onto blank lines) and the preamble's
// own emitted comment carries phantom mappings. The fixture is a real banner
// `.js.map` (one source line ballooned under a 9-line copyright block).
//
//  1. Take a real banner-shifted map and adjust it for a 9-line preamble.
//  2. Decode before/after and pair segments by generated position.
//  3. Assert every kept segment dropped exactly 9 source lines, every
//     preamble-region segment (source line < 9) was removed, and no negative
//     source line survived.
func TestAdjustSourceMapForPreambleUndoesSourceLineShift(t *testing.T) {
  const dropLines = 9
  // Real `main.js.map` emitted for a banner project: `export const first`
  // (source line 0) ends up mapped to source line 9 before the fix.
  const shifted = `{"version":3,"file":"main.js","sourceRoot":"","sources":["../src/main.ts"],"names":[],` +
    `"mappings":";;;;AAAA;;;;;;;;GAQG;AACU,QAAA,KAAK,GAAW,GAAG,CAAC;AACpB,QAAA,MAAM,GAAW,GAAG,CAAC;AAClC,eAAsB,CAAS;IAC7B,OAAO,CAAC,GAAG,QAAA,KAAK,GAAG,QAAA,MAAM,CAAC;AAC5B,CAAC"}`

  adjusted, ok := driver.AdjustSourceMapForPreamble(shifted, dropLines)
  if !ok {
    t.Fatal("AdjustSourceMapForPreamble reported no change on a shifted map")
  }

  before := decodeSegments(t, shifted)
  after := decodeSegments(t, adjusted)

  // Every surviving real-code mapping must have moved up by exactly dropLines.
  for key, srcLine := range after {
    if srcLine < 0 {
      t.Fatalf("segment %v has negative source line %d after adjust", key, srcLine)
    }
    original, existed := before[key]
    if !existed {
      t.Fatalf("adjusted map invented a segment %v not present before", key)
    }
    if original-dropLines != srcLine {
      t.Fatalf("segment %v: source line %d -> %d, want %d", key, original, srcLine, original-dropLines)
    }
  }
  // Every preamble-region mapping (source line < dropLines) must be gone.
  for key, srcLine := range before {
    if srcLine >= dropLines {
      if _, kept := after[key]; !kept {
        t.Fatalf("segment %v (source line %d) was dropped but should be kept", key, srcLine)
      }
      continue
    }
    if _, kept := after[key]; kept {
      t.Fatalf("segment %v (source line %d) is inside the preamble region but survived", key, srcLine)
    }
  }
  // The first real statement (`exports.first`) must now map to source line 0.
  minKept := -1
  for _, srcLine := range after {
    if minKept == -1 || srcLine < minKept {
      minKept = srcLine
    }
  }
  if minKept != 0 {
    t.Fatalf("lowest source line after adjust = %d, want 0", minKept)
  }
}

// segKey identifies a mapping by its generated position so before/after segments
// can be paired regardless of delta re-encoding.
type segKey struct {
  genLine int
  genCol  int
}

// decodeSegments decodes a source map's `mappings` into a generated-position ->
// absolute-source-line map. Segments without a source position are ignored.
func decodeSegments(t *testing.T, mapText string) map[segKey]int {
  t.Helper()
  var doc struct {
    Mappings string `json:"mappings"`
  }
  if err := json.Unmarshal([]byte(mapText), &doc); err != nil {
    t.Fatalf("invalid map JSON: %v", err)
  }
  const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  decode := func(seg string) []int {
    var out []int
    shift, value := 0, 0
    for i := 0; i < len(seg); i++ {
      d := strings.IndexByte(b64, seg[i])
      cont := d&32 != 0
      value += (d & 31) << shift
      if cont {
        shift += 5
        continue
      }
      if value&1 != 0 {
        out = append(out, -(value >> 1))
      } else {
        out = append(out, value>>1)
      }
      shift, value = 0, 0
    }
    return out
  }
  result := map[segKey]int{}
  var srcLine int
  for li, line := range strings.Split(doc.Mappings, ";") {
    if line == "" {
      continue
    }
    genCol := 0
    for _, seg := range strings.Split(line, ",") {
      if seg == "" {
        continue
      }
      f := decode(seg)
      genCol += f[0]
      if len(f) < 4 {
        continue
      }
      srcLine += f[2]
      result[segKey{genLine: li, genCol: genCol}] = srcLine
    }
  }
  return result
}
